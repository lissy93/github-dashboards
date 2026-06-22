import { json } from '@sveltejs/kit';
import { getRepoWorkflows } from '$lib/server/github/workflows';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Per-workflow status, pass rate and runtime for a repo's GitHub Actions
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await getRepoWorkflows(params.user, params.repo), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('repo-workflows-endpoint', caught);
	}
};
