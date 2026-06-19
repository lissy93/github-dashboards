import { graphql } from '$lib/server/github/client';
import { snapshotStars } from '$lib/server/github/stars';
import { cached, isCached } from '$lib/server/cache';
import { AppError } from '$lib/errors';
import { createLogger } from '$lib/logger';
import type { Repo, UserOverview, UserProfile } from '$lib/types';

const log = createLogger('user-overview');

const PAGE = 100;
const MAX_PAGES = 10;

// Cheap fields only, the heavier per-repo counts load lazily via repo-stats
const REPO_FIELDS = `
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
				organizations(first: 12) { nodes { login name avatarUrl } }
				contributionsCollection { contributionCalendar { totalContributions } }
				ownedRepos: repositories(first: ${PAGE}, ${OWNED_ARGS}) {
					totalCount nodes { ...repoFields } pageInfo { hasNextPage endCursor }
				}
			}
			... on Organization {
				name description location websiteUrl twitterUsername createdAt
				ownedRepos: repositories(first: ${PAGE}, ${ORG_ARGS}) {
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
			repositoriesContributedTo(first: ${PAGE}, ${CONTRIB_ARGS}) {
				nodes { ...repoFields } pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const CONTRIB_PAGE_QUERY = `
	${REPO_FIELDS}
	query ContribPage($login: String!, $cursor: String!) {
		user(login: $login) {
			repositoriesContributedTo(first: ${PAGE}, after: $cursor, ${CONTRIB_ARGS}) {
				nodes { ...repoFields } pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

type RawRepo = {
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
	organizations?: { nodes: { login: string; name: string | null; avatarUrl: string }[] };
	contributionsCollection?: { contributionCalendar: { totalContributions: number } };
	ownedRepos: RawConn & { totalCount: number };
};

type FetchedRepos = { nodes: RawRepo[]; capped: boolean };

// Contributed repos run as their own query so it never shares the owned timeout
async function fetchContributed(login: string): Promise<FetchedRepos> {
	const first = await graphql<{ user: { repositoriesContributedTo: RawConn } | null }>(
		CONTRIB_FIRST_QUERY,
		{ login }
	);
	const conn = first.user?.repositoriesContributedTo;
	if (!conn) return { nodes: [], capped: false };
	return fetchAll(conn, 'contributed repos', login, async (cursor) => {
		const data = await graphql<{ user: { repositoriesContributedTo: RawConn } }>(
			CONTRIB_PAGE_QUERY,
			{ login, cursor }
		);
		return data.user.repositoriesContributedTo;
	});
}

// Walk a repo connection to the end, capped at MAX_PAGES to stay within limits
async function fetchAll(
	first: RawConn,
	label: string,
	login: string,
	nextPage: (cursor: string) => Promise<RawConn>
): Promise<FetchedRepos> {
	const nodes = [...first.nodes];
	let info = first.pageInfo;
	let pages = 1;
	while (info.hasNextPage && info.endCursor && pages < MAX_PAGES) {
		const conn = await nextPage(info.endCursor);
		nodes.push(...conn.nodes);
		info = conn.pageInfo;
		pages += 1;
	}
	const capped = info.hasNextPage;
	if (capped) log.warn(`${label} truncated at ${nodes.length} for ${login}`);
	return { nodes, capped };
}

// Drop the placeholder GitHub returns for an unrecognised licence file
function normalizeLicense(spdxId: string | null | undefined): string | null {
	return spdxId && spdxId !== 'NOASSERTION' ? spdxId : null;
}

function mapRepo(raw: RawRepo): Repo {
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
const overviewKey = (login: string) => `user:overview:9:${login.toLowerCase()}`;

// Whether this overview is already cached, so the page can render it inline
export const isUserOverviewCached = (login: string) => isCached(overviewKey(login));

// Fetch a user or org overview: profile, all owned repos and contributed repos
export function getUserOverview(login: string): Promise<UserOverview> {
	return cached(overviewKey(login), async () => {
		const { repositoryOwner: owner } = await graphql<{ repositoryOwner: RawOwner | null }>(
			OVERVIEW_QUERY,
			{ login }
		);
		if (!owner) throw new AppError('not_found', `No user or org named ${login}`);

		// Owned and contributed are separate queries so neither shares the other's timeout
		const ownedTask = fetchAll(owner.ownedRepos, 'owned repos', login, async (cursor) => {
			const data = await graphql<{ repositoryOwner: { repos: RawConn } }>(OWNED_PAGE_QUERY, {
				login,
				cursor
			});
			return data.repositoryOwner.repos;
		});

		const [owned, contributed] = await Promise.all([
			ownedTask,
			owner.__typename === 'User'
				? fetchContributed(login)
				: Promise.resolve<FetchedRepos>({ nodes: [], capped: false })
		]);

		const ownedRepos = owned.nodes.map(mapRepo);

		// Record today's star counts so deltas can build up over time
		try {
			await snapshotStars(ownedRepos);
		} catch (error) {
			log.warn(`star snapshot failed for ${login}`, error);
		}

		return {
			profile: mapProfile(owner, ownedRepos),
			ownedRepos,
			contributedRepos: contributed.nodes.map(mapRepo),
			ownedReposCapped: owned.capped,
			contributedReposCapped: contributed.capped
		};
	});
}
