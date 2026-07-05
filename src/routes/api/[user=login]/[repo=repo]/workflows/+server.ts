import { json } from '@sveltejs/kit';
import { advanceRepoWorkflows, getRepoWorkflows } from '$lib/server/github/workflows';
import { requireRepo } from '$lib/server/github/repo';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Workflow summaries, advancing the batched crawl one chunk when a signed-in viewer
// asks, so the table fills in progressively and the deeper state caches for everyone
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	try {
		await requireRepo(params.user, params.repo, locals.user?.login);
		// Only a signed-in viewer drives the deeper crawl, anonymous stays on the background bound
		const advance = url.searchParams.has('advance') && !!locals.user;
		setHeaders({ 'cache-control': 'private, no-store' });
		const workflows = advance
			? await advanceRepoWorkflows(params.user, params.repo)
			: await getRepoWorkflows(params.user, params.repo);
		return json(workflows);
	} catch (caught) {
		return apiError('repo-workflows-endpoint', caught);
	}
};
