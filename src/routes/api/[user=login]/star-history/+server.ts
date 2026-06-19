import { json } from '@sveltejs/kit';
import { getUserStarHistory } from '$lib/server/github/star-history';
import { logError } from '$lib/errors';
import type { RequestHandler } from './$types';

// Reconstructed star history for the owned repos, loaded lazily so it never blocks the page
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=300' });
	try {
		return json(await getUserStarHistory(params.user));
	} catch (caught) {
		logError('star-history-endpoint', caught);
		return json({ days: [], series: [] });
	}
};
