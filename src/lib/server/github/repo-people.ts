import type { AudienceSection, PersonRow, Repo, RepoPeople } from '$lib/types';
import { rest } from '$lib/server/github/client';
import { newestStarPage, STAR_PAGE_CAP, STAR_PER_PAGE } from '$lib/server/github/stargazer-page';
import { getRepo } from '$lib/server/github/repo';
import { cached, isCached } from '$lib/server/cache';
import { AppError } from '$lib/utils/errors';

const TTL = 6 * 3600;
// Short side panels, so only a handful of faces each
const KEEP = 10;
// Past this many stars GitHub stops paginating, so the recent tail is unreachable
const STAR_CAP = STAR_PAGE_CAP * STAR_PER_PAGE;

type RawFork = { created_at: string; owner: { login: string; avatar_url: string } };
type RawUser = { login: string; avatar_url: string };

// Newest stargazers come from the last reachable page, since the listing is oldest first
async function newestStargazers(repo: Repo): Promise<PersonRow[]> {
	const page = await newestStarPage(repo);
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

// Fetch one audience list, flagging a permission block as restricted rather than throwing,
// so a scope gap on one list does not blank the whole panel group. Real faults still throw
async function section(
	total: number,
	fetchRows: () => Promise<PersonRow[]>
): Promise<AudienceSection> {
	try {
		return { people: await fetchRows(), total };
	} catch (error) {
		if (error instanceof AppError && (error.code === 'forbidden' || error.code === 'unauthorized'))
			return { people: [], total, unavailable: 'restricted' };
		throw error;
	}
}

const blank: AudienceSection = { people: [], total: 0 };

const key = (owner: string, name: string) => `repo:people:v4:${owner}/${name}`.toLowerCase();

export const isRepoPeopleCached = (owner: string, name: string) => isCached(key(owner, name));

// Stargazers, forks and watchers for a repo, the audience behind the contributors
export function getRepoPeople(owner: string, name: string): Promise<RepoPeople> {
	return cached(
		key(owner, name),
		async () => {
			const repo = await getRepo(owner, name);
			if (!repo) return { stargazers: blank, forks: blank, watchers: blank };
			const [stargazers, forks, watchers] = await Promise.all([
				repo.stars > STAR_CAP
					? { people: [], total: repo.stars, unavailable: 'capped' as const }
					: section(repo.stars, () => newestStargazers(repo)),
				section(repo.forks, () => newestForks(repo.owner, repo.name)),
				section(repo.watchers, () => watcherList(repo.owner, repo.name))
			]);
			return { stargazers, forks, watchers };
		},
		TTL
	);
}
