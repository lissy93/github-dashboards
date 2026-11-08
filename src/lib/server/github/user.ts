import { batchedGraphql, graphql, rest } from '$lib/server/github/client';
import { snapshotStars } from '$lib/server/github/stars';
import { cached, readCached, writeCached } from '$lib/server/cache';
import { AppError, rootReason, toAppError } from '$lib/utils/errors';
import { createLogger } from '$lib/utils/logger';
import type { Org, Repo, UserOverview, UserProfile } from '$lib/types';

const log = createLogger('user-overview');

const PAGE = 100;
const INITIAL_PAGE = 30;
const PAGES_PER_SYNC = 3;
// enough to cover the whole owned list, anything past it finishes over later syncs
const REWALK_PAGES = 12;
const TTL = 900;

// Cheap fields only, the heavier per-repo counts load lazily via repo-stats
export const REPO_FIELDS = `
	fragment repoFields on Repository {
		name
		nameWithOwner
		description
		url
		stargazerCount
		forkCount
		diskUsage
		isPrivate
		isArchived
		isFork
		createdAt
		updatedAt
		pushedAt
		owner { login }
		primaryLanguage { name color }
		watchers { totalCount }
		openIssues: issues(states: OPEN) { totalCount }
		openPRs: pullRequests(states: OPEN) { totalCount }
		licenseInfo { spdxId }
		repositoryTopics(first: 8) { nodes { topic { name } } }
	}
`;

// Only authored commits count here, so unmerged PRs and issues are excluded
const CONTRIB_ARGS = `
	privacy: PUBLIC, includeUserRepositories: false
	contributionTypes: [COMMIT]
	orderBy: { field: STARGAZERS, direction: DESC }
`;
const OWNED_ARGS = `privacy: PUBLIC, ownerAffiliations: OWNER, orderBy: { field: STARGAZERS, direction: DESC }`;
const ORG_ARGS = `privacy: PUBLIC, orderBy: { field: STARGAZERS, direction: DESC }`;

const OVERVIEW_QUERY = `
	${REPO_FIELDS}
	query Overview($login: String!) {
		repositoryOwner(login: $login) {
			__typename
			login
			avatarUrl
			... on User {
				name bio company location websiteUrl twitterUsername createdAt
				followers { totalCount }
				following { totalCount }
				contributionsCollection { contributionCalendar { totalContributions } }
				ownedRepos: repositories(first: ${INITIAL_PAGE}, ${OWNED_ARGS}) {
					totalCount nodes { ...repoFields } pageInfo { hasNextPage endCursor }
				}
			}
			... on Organization {
				name description location websiteUrl twitterUsername createdAt
				ownedRepos: repositories(first: ${INITIAL_PAGE}, ${ORG_ARGS}) {
					totalCount nodes { ...repoFields } pageInfo { hasNextPage endCursor }
				}
			}
		}
	}
`;

const OWNED_PAGE_QUERY = `
	${REPO_FIELDS}
	query OwnedPage($login: String!, $cursor: String!) {
		repositoryOwner(login: $login) {
			... on User {
				repos: repositories(first: ${PAGE}, after: $cursor, ${OWNED_ARGS}) {
					nodes { ...repoFields } pageInfo { hasNextPage endCursor }
				}
			}
			... on Organization {
				repos: repositories(first: ${PAGE}, after: $cursor, ${ORG_ARGS}) {
					nodes { ...repoFields } pageInfo { hasNextPage endCursor }
				}
			}
		}
	}
`;

const CONTRIB_FIRST_QUERY = `
	${REPO_FIELDS}
	query ContribFirst($login: String!) {
		user(login: $login) {
			repositoriesContributedTo(first: ${INITIAL_PAGE}, ${CONTRIB_ARGS}) {
				totalCount nodes { ...repoFields } pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const CONTRIB_PAGE_QUERY = `
	${REPO_FIELDS}
	query ContribPage($login: String!, $cursor: String!) {
		user(login: $login) {
			repositoriesContributedTo(first: ${PAGE}, after: $cursor, ${CONTRIB_ARGS}) {
				totalCount nodes { ...repoFields } pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

export type RawRepo = {
	name: string;
	nameWithOwner: string;
	description: string | null;
	url: string;
	stargazerCount: number;
	forkCount: number;
	diskUsage: number | null;
	isPrivate: boolean;
	isArchived: boolean;
	isFork: boolean;
	createdAt: string;
	updatedAt: string;
	pushedAt: string;
	owner: { login: string };
	primaryLanguage: { name: string; color: string | null } | null;
	watchers: { totalCount: number };
	openIssues: { totalCount: number };
	openPRs: { totalCount: number };
	licenseInfo: { spdxId: string | null } | null;
	repositoryTopics: { nodes: { topic: { name: string } | null }[] };
};

type RawConn = {
	nodes: RawRepo[];
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
	totalCount?: number;
};

type RawOwner = {
	__typename: 'User' | 'Organization';
	login: string;
	avatarUrl: string;
	name: string | null;
	bio?: string | null;
	description?: string | null;
	company?: string | null;
	location: string | null;
	websiteUrl: string | null;
	twitterUsername: string | null;
	createdAt: string;
	followers?: { totalCount: number };
	following?: { totalCount: number };
	organizations?: { nodes: Org[] };
	contributionsCollection?: { contributionCalendar: { totalContributions: number } };
	ownedRepos: RawConn & { totalCount: number };
};

type RepoProgress = {
	nodes: RawRepo[];
	cursor: string | null;
	complete: boolean;
	total: number;
};
type OverviewState = { owner: RawOwner; owned: RepoProgress; contributed: RepoProgress };

function progress(conn?: RawConn | null): RepoProgress {
	return {
		nodes: conn?.nodes ?? [],
		cursor: conn?.pageInfo.endCursor ?? null,
		complete: !conn?.pageInfo.hasNextPage,
		total: conn?.totalCount ?? conn?.nodes.length ?? 0
	};
}

function mergeRepos(...groups: RawRepo[][]): RawRepo[] {
	return [
		...new Map(groups.flat().map((repo) => [repo.nameWithOwner.toLowerCase(), repo])).values()
	].sort((first, second) => second.stargazerCount - first.stargazerCount);
}

async function resume(
	current: RepoProgress,
	pages: number,
	nextPage: (cursor: string) => Promise<RawConn>
): Promise<RepoProgress> {
	let { cursor, complete } = current;
	let nodes = current.nodes;
	let total = current.total;
	for (let page = 0; !complete && cursor && page < pages; page++) {
		const conn = await nextPage(cursor);
		nodes = mergeRepos(nodes, conn.nodes);
		total = conn.totalCount ?? total;
		cursor = conn.pageInfo.endCursor;
		complete = !conn.pageInfo.hasNextPage;
	}
	return { nodes: nodes.slice(0, total), cursor, complete, total };
}

// Drop the placeholder GitHub returns for an unrecognised licence file
function normalizeLicense(spdxId: string | null | undefined): string | null {
	return spdxId && spdxId !== 'NOASSERTION' ? spdxId : null;
}

export function mapRepo(raw: RawRepo): Repo {
	return {
		owner: raw.owner.login,
		name: raw.name,
		nameWithOwner: raw.nameWithOwner,
		description: raw.description,
		url: raw.url,
		stars: raw.stargazerCount,
		forks: raw.forkCount,
		watchers: raw.watchers.totalCount,
		openIssues: raw.openIssues.totalCount,
		openPRs: raw.openPRs.totalCount,
		diskUsage: raw.diskUsage ?? 0,
		language: raw.primaryLanguage,
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
		pushedAt: raw.pushedAt,
		isPrivate: raw.isPrivate,
		isArchived: raw.isArchived,
		isFork: raw.isFork,
		// NOASSERTION means GitHub found a licence file it could not identify, treat as none
		license: normalizeLicense(raw.licenseInfo?.spdxId),
		topics: raw.repositoryTopics.nodes
			.map((node) => node.topic?.name)
			.filter((name): name is string => !!name)
	};
}

// Display names for orgs in one batched query, since the REST list only carries logins
async function fetchOrgNames(logins: string[]): Promise<Map<string, string>> {
	const data = await batchedGraphql<string, { login: string; name: string | null } | null>(
		'OrgNames',
		logins,
		(index) => `$o${index}: String!`,
		(index) => `o${index}: organization(login: $o${index}) { login name }`,
		(login, index) => ({ [`o${index}`]: login })
	).catch((caught) => {
		log.warn('org name hydration failed', { code: toAppError(caught).code });
		return {};
	});
	const named = Object.values(data).filter((org) => org?.name);
	return new Map(named.map((org) => [org!.login, org!.name!]));
}

// Public org memberships via REST, since GraphQL User.organizations needs read:org
async function fetchOrgs(login: string): Promise<Org[]> {
	const orgs = await rest<{ login: string; avatar_url: string }[]>(
		`/users/${encodeURIComponent(login)}/orgs?per_page=12`
	).catch((caught) => {
		log.warn(`org list failed for ${login}`, { code: toAppError(caught).code });
		return null;
	});
	if (!orgs?.length) return [];
	const names = await fetchOrgNames(orgs.map((org) => org.login));
	return orgs.map((org) => ({
		login: org.login,
		name: names.get(org.login) ?? null,
		avatarUrl: org.avatar_url
	}));
}

function mapProfile(owner: RawOwner, ownedRepos: Repo[]): UserProfile {
	return {
		login: owner.login,
		name: owner.name,
		avatarUrl: owner.avatarUrl,
		bio: owner.bio ?? owner.description ?? null,
		company: owner.company ?? null,
		location: owner.location,
		websiteUrl: owner.websiteUrl,
		twitter: owner.twitterUsername,
		isOrg: owner.__typename === 'Organization',
		createdAt: owner.createdAt,
		followers: owner.followers?.totalCount ?? 0,
		following: owner.following?.totalCount ?? 0,
		organizations: owner.organizations?.nodes ?? [],
		repoCount: owner.ownedRepos.totalCount,
		totalStars: ownedRepos.reduce((sum, repo) => sum + repo.stars, 0),
		contributionsLastYear:
			owner.contributionsCollection?.contributionCalendar.totalContributions ?? 0
	};
}

// Bump the version when the stored shape changes, to retire old entries
const overviewKey = (login: string) => `user:overview-state:v1:${login.toLowerCase()}`;
const legacyOverviewKey = (login: string) => `user:overview:9:${login.toLowerCase()}`;
const syncing = new Map<string, Promise<OverviewState>>();

function toOverview(state: OverviewState): UserOverview {
	const ownedRepos = state.owned.nodes.map(mapRepo);
	return {
		profile: mapProfile(state.owner, ownedRepos),
		ownedRepos,
		contributedRepos: state.contributed.nodes.map(mapRepo),
		ownedReposCapped: !state.owned.complete,
		contributedReposCapped: !state.contributed.complete
	};
}

// without rewalkOwned a complete owned list never repaginates and its counts freeze
async function syncOverview(
	login: string,
	current?: OverviewState,
	rewalkOwned = false
): Promise<OverviewState> {
	const cacheKey = overviewKey(login);
	const running = syncing.get(cacheKey);
	if (running) return running;

	const task = (async () => {
		const contributedTask = graphql<{
			user: { repositoriesContributedTo: RawConn } | null;
		}>(CONTRIB_FIRST_QUERY, { login }).catch((caught) => {
			log.warn(`contributed repos refresh failed for ${login}`, {
				code: toAppError(caught).code
			});
			return null;
		});
		const { repositoryOwner: owner } = await graphql<{ repositoryOwner: RawOwner | null }>(
			OVERVIEW_QUERY,
			{ login }
		);
		if (!owner) throw new AppError('not_found', `No user or org named ${login}`);
		// Orgs only apply to users, fetched in parallel with the repo pagination below
		const orgsTask = owner.__typename === 'User' ? fetchOrgs(login) : null;
		const contributedData = owner.__typename === 'User' ? await contributedTask : null;
		// A cold start still walks a few pages so the first paint is not just 30 repos
		const pageBudget = rewalkOwned ? REWALK_PAGES : PAGES_PER_SYNC;

		const ownedFirst = progress(owner.ownedRepos);
		const ownedNodes = mergeRepos(current?.owned.nodes ?? [], owner.ownedRepos.nodes).slice(
			0,
			owner.ownedRepos.totalCount
		);
		const ownedStart =
			current && !rewalkOwned && current.owned.total === owner.ownedRepos.totalCount
				? { ...current.owned, nodes: ownedNodes }
				: { ...ownedFirst, nodes: ownedNodes };
		const contributedFirst =
			owner.__typename === 'User' ? contributedData?.user?.repositoriesContributedTo : null;
		const contributedNodes = mergeRepos(
			current?.contributed.nodes ?? [],
			contributedFirst?.nodes ?? []
		).slice(0, contributedFirst?.totalCount);
		const contributedStart =
			owner.__typename === 'User' && !contributedData
				? (current?.contributed ?? {
						nodes: [],
						cursor: null,
						complete: false,
						total: 0
					})
				: current &&
					  contributedFirst?.totalCount !== undefined &&
					  current.contributed.total === contributedFirst.totalCount
					? { ...current.contributed, nodes: contributedNodes }
					: { ...progress(contributedFirst), nodes: contributedNodes };
		const owned = await resume(ownedStart, pageBudget, async (cursor) => {
			const data = await graphql<{ repositoryOwner: { repos: RawConn } }>(OWNED_PAGE_QUERY, {
				login,
				cursor
			});
			return data.repositoryOwner.repos;
		}).catch((caught) => {
			log.warn(`owned repos pagination failed for ${login}`, {
				code: toAppError(caught).code
			});
			return ownedStart;
		});
		const contributed =
			owner.__typename === 'User'
				? await resume(contributedStart, pageBudget, async (cursor) => {
						const data = await graphql<{ user: { repositoriesContributedTo: RawConn } }>(
							CONTRIB_PAGE_QUERY,
							{ login, cursor }
						);
						return data.user.repositoriesContributedTo;
					}).catch((caught) => {
						log.warn(`contributed repos pagination failed for ${login}`, {
							code: toAppError(caught).code
						});
						return contributedStart;
					})
				: progress();
		if (orgsTask) owner.organizations = { nodes: await orgsTask };
		const state = { owner, owned, contributed };
		await writeCached(cacheKey, state, TTL);

		// Record today's star counts so deltas can build up over time, best effort
		try {
			await snapshotStars(owned.nodes.map(mapRepo));
		} catch (error) {
			log.warn(`star snapshot failed for ${login}`, { reason: rootReason(error) });
		}
		return state;
	})().finally(() => syncing.delete(cacheKey));

	syncing.set(cacheKey, task);
	return task;
}

// Cheap account-type lookup for layouts, so they never wait on a full overview sync
export async function isOrgAccount(login: string): Promise<boolean> {
	const { isOrg } = await cached(
		`user:kind:v1:${login.toLowerCase()}`,
		async () => {
			const stored = await readCached<OverviewState>(overviewKey(login)).catch(() => null);
			if (stored) return { isOrg: stored.value.owner.__typename === 'Organization' };
			const { repositoryOwner } = await graphql<{
				repositoryOwner: { __typename: string } | null;
			}>(
				`
					query Kind($login: String!) {
						repositoryOwner(login: $login) {
							__typename
						}
					}
				`,
				{
					login
				}
			);
			if (!repositoryOwner) throw new AppError('not_found', `No user or org named ${login}`);
			return { isOrg: repositoryOwner.__typename === 'Organization' };
		},
		7 * 86400
	);
	return isOrg;
}

// Serve the last complete checkpoint, refreshing metadata and resuming pagination
export async function getUserOverview(login: string): Promise<UserOverview> {
	const cacheKey = overviewKey(login);
	let stored: Awaited<ReturnType<typeof readCached<OverviewState>>> = null;
	try {
		stored = await readCached<OverviewState>(cacheKey);
	} catch (caught) {
		log.warn(`overview cache read failed for ${login}`, { code: toAppError(caught).code });
	}
	if (!stored) {
		const legacy = await readCached<UserOverview>(legacyOverviewKey(login)).catch(() => null);
		let state: OverviewState;
		try {
			state = await syncOverview(login);
		} catch (caught) {
			if (legacy) return legacy.value;
			throw caught;
		}
		if (!state.owned.complete || !state.contributed.complete) {
			void syncOverview(login, state).catch((caught) =>
				log.warn(`overview backfill failed for ${login}`, {
					code: toAppError(caught).code
				})
			);
		}
		return toOverview(state);
	}

	const stale = Date.now() - stored.fetchedAt.getTime() >= TTL * 1000;
	if (stale) {
		void syncOverview(login, stored.value).catch((caught) =>
			log.warn(`overview refresh failed for ${login}`, { code: toAppError(caught).code })
		);
	}
	return toOverview(stored.value);
}

// The cached profile only, never syncing, null until someone has loaded the overview
export async function peekUserProfile(login: string): Promise<UserProfile | null> {
	const stored = await readCached<OverviewState>(overviewKey(login));
	return stored ? mapProfile(stored.value.owner, stored.value.owned.nodes.map(mapRepo)) : null;
}

// blocking sync of every owned repo, for callers that need live counts
export async function refreshUserOverview(login: string): Promise<UserOverview> {
	// joining a shallow sync already in flight would skip the rewalk
	await syncing.get(overviewKey(login))?.catch(() => {});
	const stored = await readCached<OverviewState>(overviewKey(login)).catch(() => null);
	return toOverview(await syncOverview(login, stored?.value, true));
}
