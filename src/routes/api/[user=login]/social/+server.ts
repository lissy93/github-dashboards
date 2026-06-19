import { json } from '@sveltejs/kit';
import { getUserSocial, EMPTY_SOCIAL } from '$lib/server/github/social';
import { logError } from '$lib/errors';
import type { RequestHandler } from './$types';

// Notable followers and sponsors, loaded lazily so they never block the page
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=300' });
	try {
		return json(await getUserSocial(params.user));
	} catch (caught) {
		logError('social-endpoint', caught);
		return json(EMPTY_SOCIAL);
	}
};
