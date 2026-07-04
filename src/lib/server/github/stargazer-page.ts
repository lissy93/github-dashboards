import { rest } from '$lib/server/github/client';
import type { Repo } from '$lib/types';

export const STAR_ACCEPT = 'application/vnd.github.star+json';
export const STAR_PER_PAGE = 100;
// GitHub paginates only the first 40k stargazers, past that the tail is old not recent
export const STAR_PAGE_CAP = 400;

export type RawStar = { starred_at: string; user: { login: string; avatar_url: string } };

// Newest stargazers live on the last reachable page, since the listing is oldest first
export async function newestStarPage(repo: Repo): Promise<RawStar[]> {
	if (repo.stars === 0 || repo.stars > STAR_PAGE_CAP * STAR_PER_PAGE) return [];
	const lastPage = Math.ceil(repo.stars / STAR_PER_PAGE);
	return (
		(await rest<RawStar[]>(
			`/repos/${repo.owner}/${repo.name}/stargazers?per_page=${STAR_PER_PAGE}&page=${lastPage}`,
			{ headers: { Accept: STAR_ACCEPT } }
		)) ?? []
	);
}
