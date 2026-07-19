import { json } from '@sveltejs/kit';
import { getTopRepos } from '$lib/server/github/top-repos';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// A handful of most starred repos, feeds the command palette suggestions
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await getTopRepos(params.user), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('top-repos-endpoint', caught);
	}
};
