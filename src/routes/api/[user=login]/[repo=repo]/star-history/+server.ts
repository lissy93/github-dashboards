import { json } from '@sveltejs/kit';
import { getRepoStarHistory } from '$lib/server/github/star-history';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Reconstructed star curve for a single repo
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await getRepoStarHistory(params.user, params.repo), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('repo-star-history-endpoint', caught);
	}
};
