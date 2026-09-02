import type { AudienceSection, PersonRow, RepoPeople } from '$lib/types';
import { graphql, isRefusedList, looksRestricted } from '$lib/server/github/client';
import { usingAppToken, withAppToken } from '$lib/server/auth/context';
import { cached, isCached } from '$lib/server/cache';

const TTL = 6 * 3600;
// Short side panels, so only a handful of faces each
const KEEP = 10;

type RawUser = { login: string; avatarUrl: string };
type AudienceData = {
	repository: {
		stargazerCount: number;
		watchers: { totalCount: number; nodes: RawUser[] };
		forks: { totalCount: number; nodes: { createdAt: string; owner: RawUser }[] };
	} | null;
};
type StargazerData = {
	repository: {
		stargazers: { totalCount: number; edges: { starredAt: string; node: RawUser }[] };
	} | null;
};

// stargazerCount is the plain scalar, readable even where the list below is not
const AUDIENCE_QUERY = `
	query RepoAudience($owner: String!, $name: String!, $keep: Int!) {
		repository(owner: $owner, name: $name) {
			stargazerCount
			watchers(first: $keep) {
				totalCount
				nodes { login avatarUrl }
			}
			forks(first: $keep, orderBy: { field: CREATED_AT, direction: DESC }) {
				totalCount
				nodes { createdAt owner { login avatarUrl } }
			}
		}
	}
`;

// The gated list rides alone, one refusal used to take the forks and watchers with it
const STARGAZERS_QUERY = `
	query RepoStargazers($owner: String!, $name: String!, $keep: Int!) {
		repository(owner: $owner, name: $name) {
			stargazers(first: $keep, orderBy: { field: STARRED_AT, direction: DESC }) {
				totalCount
				edges { starredAt node { login avatarUrl } }
			}
		}
	}
`;

const blank: AudienceSection = { people: [], total: 0 };

// An empty list against a real count means GitHub restricted it to repo admins, flag it
// so the panel gates instead of showing a false "none yet"
function toSection(total: number, people: PersonRow[]): AudienceSection {
	if (looksRestricted(total, people.length)) return { total, people, unavailable: 'restricted' };
	return { total, people };
}

// The stargazer list under the current token, null when GitHub refuses it outright
async function fetchStargazers(owner: string, name: string): Promise<AudienceSection | null> {
	try {
		const { repository } = await graphql<StargazerData>(STARGAZERS_QUERY, {
			owner,
			name,
			keep: KEEP
		});
		const stars = repository?.stargazers;
		if (!stars) return blank;
		return toSection(
			stars.totalCount,
			stars.edges.map((edge) => ({
				login: edge.node.login,
				avatarUrl: edge.node.avatarUrl,
				at: edge.starredAt
			}))
		);
	} catch (error) {
		if (!isRefusedList(error)) throw error;
		return null;
	}
}

// One audience read under the current token, the two queries in parallel
async function fetchPeople(owner: string, name: string): Promise<RepoPeople> {
	const [{ repository }, stargazers] = await Promise.all([
		graphql<AudienceData>(AUDIENCE_QUERY, { owner, name, keep: KEEP }),
		fetchStargazers(owner, name)
	]);
	if (!repository) return { stargazers: blank, forks: blank, watchers: blank };
	return {
		// A refused list still shows its real count beside the gate
		stargazers: stargazers ?? {
			total: repository.stargazerCount,
			people: [],
			unavailable: 'restricted'
		},
		forks: toSection(
			repository.forks.totalCount,
			repository.forks.nodes.map((fork) => ({
				login: fork.owner.login,
				avatarUrl: fork.owner.avatarUrl,
				at: fork.createdAt
			}))
		),
		watchers: toSection(
			repository.watchers.totalCount,
			repository.watchers.nodes.map((user) => ({
				login: user.login,
				avatarUrl: user.avatarUrl
			}))
		)
	};
}

// Stargazers are gated on the app token too, so only the other two are worth a retry
const anyGated = (people: RepoPeople) =>
	[people.forks, people.watchers].some((section) => section.unavailable);

const key = (owner: string, name: string) => `repo:people:v5:${owner}/${name}`.toLowerCase();

export const isRepoPeopleCached = (owner: string, name: string) => isCached(key(owner, name));

// Stargazers, forks and watchers for a repo, the audience behind the contributors.
// A non-admin viewer gets gated lists, so retry those once on the app token before caching
export function getRepoPeople(owner: string, name: string): Promise<RepoPeople> {
	return cached(
		key(owner, name),
		async () => {
			const people = await fetchPeople(owner, name);
			if (!anyGated(people) || usingAppToken()) return people;
			return withAppToken(() => fetchPeople(owner, name));
		},
		TTL
	);
}
