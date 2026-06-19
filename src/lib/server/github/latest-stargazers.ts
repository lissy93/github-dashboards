import { rest } from '$lib/server/github/client';
import { getUserOverview } from '$lib/server/github/user';
import { cached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { AppError } from '$lib/errors';
import { createLogger } from '$lib/logger';
import type { Repo, RecentStar } from '$lib/types';

const log = createLogger('latest-stargazers');

const PER_PAGE = 100;
// Most recent stars cluster on a user's biggest repos, so only scan the top few
const TOP_REPOS = 40;
// GitHub paginates only the first 40k stargazers; past that the newest are unreachable
const PAGE_CAP = 400;
const KEEP = 12;
const CONCURRENCY = 6;
const TTL = 6 * 3600;
const STAR_ACCEPT = 'application/vnd.github.star+json';

type RawStar = { starred_at: string; user: { login: string; avatar_url: string } };

// The most recent stargazers across a user's owned repos, merged and deduped
export function getLatestStargazers(login: string): Promise<RecentStar[]> {
	return cached(
		`user:latest-stargazers:v1:${login.toLowerCase()}`,
		async () => {
			const { ownedRepos } = await getUserOverview(login);
			const targets = ownedRepos
				.filter((repo) => repo.stars > 0)
				.sort((first, second) => second.stars - first.stars)
				.slice(0, TOP_REPOS);
			const perRepo = await mapLimit(targets, CONCURRENCY, (repo) => newestForRepo(repo));
			// A flaky repo just drops out, but don't cache "no stars" when they all fall over
			if (targets.length && perRepo.every((result) => result === null)) {
				throw new AppError('upstream', 'Stargazers refresh failed', { expose: false });
			}
			return mergeNewest(perRepo.flatMap((result) => result ?? []));
		},
		TTL
	);
}

// Newest stargazers for one repo from its last reachable page, null if the fetch fails
async function newestForRepo(repo: Repo): Promise<RecentStar[] | null> {
	const lastPage = Math.ceil(repo.stars / PER_PAGE);
	// Past the pagination cap the reachable tail is old, not recent, so skip it
	if (lastPage > PAGE_CAP) return [];
	try {
		const page =
			(await rest<RawStar[]>(
				`/repos/${repo.owner}/${repo.name}/stargazers?per_page=${PER_PAGE}&page=${lastPage}`,
				{ headers: { Accept: STAR_ACCEPT } }
			)) ?? [];
		return page.slice(-KEEP).map((star) => ({
			login: star.user.login,
			avatarUrl: star.user.avatar_url,
			repo: repo.name,
			starredAt: star.starred_at
		}));
	} catch (error) {
		log.warn(`stargazers failed for ${repo.nameWithOwner}`, error);
		return null;
	}
}

// Newest first, one row per person keeping their most recent star
function mergeNewest(stars: RecentStar[]): RecentStar[] {
	const byLogin = new Map<string, RecentStar>();
	for (const star of stars) {
		const seen = byLogin.get(star.login);
		if (!seen || star.starredAt > seen.starredAt) byLogin.set(star.login, star);
	}
	return [...byLogin.values()]
		.sort((first, second) => second.starredAt.localeCompare(first.starredAt))
		.slice(0, KEEP);
}
