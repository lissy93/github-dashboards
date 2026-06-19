import { json } from '@sveltejs/kit';
import { getOwnedRepoStats } from '$lib/server/github/repo-stats';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Heavier per-repo counts for the owned repos, loaded lazily after the list renders
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await getOwnedRepoStats(params.user), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('repo-stats-endpoint', caught);
	}
};
