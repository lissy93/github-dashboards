import type { AudienceSection, PersonRow, RepoPeople } from '$lib/types';
import { graphql, looksRestricted } from '$lib/server/github/client';
import { usingAppToken, withAppToken } from '$lib/server/auth/context';
import { cached, isCached } from '$lib/server/cache';

const TTL = 6 * 3600;
// Short side panels, so only a handful of faces each
const KEEP = 10;

type RawUser = { login: string; avatarUrl: string };
type PeopleData = {
	repository: {
		stargazers: { totalCount: number; edges: { starredAt: string; node: RawUser }[] };
		watchers: { totalCount: number; nodes: RawUser[] };
		forks: { totalCount: number; nodes: { createdAt: string; owner: RawUser }[] };
	} | null;
};

const PEOPLE_QUERY = `
	query RepoPeople($owner: String!, $name: String!, $keep: Int!) {
		repository(owner: $owner, name: $name) {
			stargazers(first: $keep, orderBy: { field: STARRED_AT, direction: DESC }) {
				totalCount
				edges { starredAt node { login avatarUrl } }
			}
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

const blank: AudienceSection = { people: [], total: 0 };

// An empty list against a real count means GitHub restricted it to repo admins, flag it
// so the panel gates instead of showing a false "none yet"
function toSection(total: number, people: PersonRow[]): AudienceSection {
	if (looksRestricted(total, people.length)) return { total, people, unavailable: 'restricted' };
	return { total, people };
}

// One audience query under the current token
async function fetchPeople(owner: string, name: string): Promise<RepoPeople> {
	const { repository } = await graphql<PeopleData>(PEOPLE_QUERY, { owner, name, keep: KEEP });
	if (!repository) return { stargazers: blank, forks: blank, watchers: blank };
	return {
		stargazers: toSection(
			repository.stargazers.totalCount,
			repository.stargazers.edges.map((edge) => ({
				login: edge.node.login,
				avatarUrl: edge.node.avatarUrl,
				at: edge.starredAt
			}))
		),
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

const anyGated = (people: RepoPeople) =>
	[people.stargazers, people.forks, people.watchers].some((section) => section.unavailable);

const key = (owner: string, name: string) => `repo:people:v5:${owner}/${name}`.toLowerCase();

export const isRepoPeopleCached = (owner: string, name: string) => isCached(key(owner, name));

// Stargazers, forks and watchers for a repo, the audience behind the contributors. A
// non-admin viewer gets gated lists, so retry those once on the app token before caching
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
