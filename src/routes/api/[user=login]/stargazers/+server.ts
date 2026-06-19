import { json } from '@sveltejs/kit';
import { getLatestStargazers } from '$lib/server/github/latest-stargazers';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Recent stargazers across the user's repos, loaded lazily so it never blocks the page
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await getLatestStargazers(params.user), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('stargazers-endpoint', caught);
	}
};
