import { json } from '@sveltejs/kit';
import { getUserStarHistory } from '$lib/server/github/star-history';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Reconstructed star history for the owned repos, loaded lazily so it never blocks the page
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await getUserStarHistory(params.user), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('star-history-endpoint', caught);
	}
};
