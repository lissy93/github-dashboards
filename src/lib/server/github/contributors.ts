import { restResponse } from '$lib/server/github/client';
import { enrichOwnedRepos } from '$lib/server/github/enrich';
import { AppError } from '$lib/errors';
import type { OwnedRepoData } from '$lib/types';

const DAY = 86400;

// Contributor count from a per_page=1 listing: the last page number is the total
export function parseContributorCount(linkHeader: string | null, bodyLength: number): number {
	const last = linkHeader?.match(/[?&]page=(\d+)>;\s*rel="last"/);
	return last ? Number(last[1]) : bodyLength;
}

async function fetchCount(owner: string, repo: string): Promise<number> {
	try {
		const res = await restResponse(`/repos/${owner}/${repo}/contributors?per_page=1&anon=1`);
		if (!res || res.status === 204) return 0;
		const body = (await res.json()) as unknown[];
		return parseContributorCount(res.headers.get('link'), body.length);
	} catch (error) {
		// An empty or restricted repo has no visible contributors
		if (error instanceof AppError && error.code === 'forbidden') return 0;
		throw error;
	}
}

// Contributor counts for the owned repos, cached as one entry with a bounded refresh
export function getOwnedContributors(login: string): Promise<OwnedRepoData<number>> {
	return enrichOwnedRepos('contributors:v2', login, DAY, async (repo) => {
		const count = await fetchCount(repo.owner, repo.name);
		return count > 0 ? count : null;
	});
}
