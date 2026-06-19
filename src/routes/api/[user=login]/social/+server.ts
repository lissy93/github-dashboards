import { json } from '@sveltejs/kit';
import { getUserSocial } from '$lib/server/github/social';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Notable followers and sponsors, loaded lazily so they never block the page
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await getUserSocial(params.user), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('social-endpoint', caught);
	}
};
