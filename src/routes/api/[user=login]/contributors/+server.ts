import { json } from '@sveltejs/kit';
import { getOwnedContributors } from '$lib/server/github/contributors';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Per-repo contributor counts for the owned repos, filled in lazily after render
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await getOwnedContributors(params.user), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('contributors-endpoint', caught);
	}
};
