import { json } from '@sveltejs/kit';
import { getLatestStargazers } from '$lib/server/github/latest-stargazers';
import { logError } from '$lib/errors';
import type { RequestHandler } from './$types';

// Recent stargazers across the user's repos, loaded lazily so it never blocks the page
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=300' });
	try {
		return json(await getLatestStargazers(params.user));
	} catch (caught) {
		logError('stargazers-endpoint', caught);
		return json([]);
	}
};
