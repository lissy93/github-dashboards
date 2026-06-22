import { rest } from '$lib/server/github/client';
import { getRepo } from '$lib/server/github/repo';
import { cached, isCached } from '$lib/server/cache';
import type { Repo } from '$lib/types';

const TTL = 6 * 3600;
const PER_PAGE = 100;
// Short side panels, so only a handful of faces each
const KEEP = 10;
// GitHub paginates only the first 40k stargazers, past that the tail is old not recent
const PAGE_CAP = 400;
const STAR_ACCEPT = 'application/vnd.github.star+json';

export type PersonRow = { login: string; avatarUrl: string; at?: string };
export type RepoPeople = {
	stargazers: PersonRow[];
	stargazersTotal: number;
	forks: PersonRow[];
	forksTotal: number;
	watchers: PersonRow[];
	watchersTotal: number;
};

type RawStar = { starred_at: string; user: { login: string; avatar_url: string } };
type RawFork = { created_at: string; owner: { login: string; avatar_url: string } };
type RawUser = { login: string; avatar_url: string };

// Newest stargazers come from the last reachable page, since the listing is oldest first
async function newestStargazers(repo: Repo): Promise<PersonRow[]> {
	if (repo.stars === 0) return [];
	const lastPage = Math.min(Math.ceil(repo.stars / PER_PAGE), PAGE_CAP);
	const page =
		(await rest<RawStar[]>(
			`/repos/${repo.owner}/${repo.name}/stargazers?per_page=${PER_PAGE}&page=${lastPage}`,
			{ headers: { Accept: STAR_ACCEPT } }
		)) ?? [];
	return page
		.slice(-KEEP)
		.reverse()
		.map((star) => ({
			login: star.user.login,
			avatarUrl: star.user.avatar_url,
			at: star.starred_at
		}));
}

// Most recently created forks, newest first
async function newestForks(owner: string, name: string): Promise<PersonRow[]> {
	const list =
		(await rest<RawFork[]>(`/repos/${owner}/${name}/forks?sort=newest&per_page=${KEEP}`)) ?? [];
	return list.map((fork) => ({
		login: fork.owner.login,
		avatarUrl: fork.owner.avatar_url,
		at: fork.created_at
	}));
}

// People watching the repo, the subscribers list has no timestamp to sort by
async function watcherList(owner: string, name: string): Promise<PersonRow[]> {
	const list =
		(await rest<RawUser[]>(`/repos/${owner}/${name}/subscribers?per_page=${KEEP}`)) ?? [];
	return list.map((user) => ({ login: user.login, avatarUrl: user.avatar_url }));
}

const key = (owner: string, name: string) => `repo:people:v2:${owner}/${name}`.toLowerCase();

export const isRepoPeopleCached = (owner: string, name: string) => isCached(key(owner, name));

// Stargazers, forks and watchers for a repo, the audience behind the contributors
export function getRepoPeople(owner: string, name: string): Promise<RepoPeople> {
	return cached(
		key(owner, name),
		async () => {
			const repo = await getRepo(owner, name);
			if (!repo) {
				return {
					stargazers: [],
					stargazersTotal: 0,
					forks: [],
					forksTotal: 0,
					watchers: [],
					watchersTotal: 0
				};
			}
			const [stargazers, forks, watchers] = await Promise.all([
				newestStargazers(repo),
				newestForks(repo.owner, repo.name),
				watcherList(repo.owner, repo.name)
			]);
			return {
				stargazers,
				stargazersTotal: repo.stars,
				forks,
				forksTotal: repo.forks,
				watchers,
				watchersTotal: repo.watchers
			};
		},
		TTL
	);
}
