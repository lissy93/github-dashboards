import { json } from '@sveltejs/kit';
import { advanceRepoWorkflows, getRepoWorkflows } from '$lib/server/github/workflows';
import { requireRepo } from '$lib/server/github/repo';
import { withForceFresh } from '$lib/server/cache';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Workflow summaries. advance walks the batched crawl one chunk deeper, fresh revalidates
// the current view, both signed-in only so the deeper state caches for everyone
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	try {
		await requireRepo(params.user, params.repo, locals.user?.login);
		const advance = url.searchParams.has('advance') && !!locals.user;
		const fresh = url.searchParams.has('fresh') && !!locals.user;
		setHeaders({ 'cache-control': 'private, no-store' });
		const load = () => getRepoWorkflows(params.user, params.repo);
		if (advance) return json(await advanceRepoWorkflows(params.user, params.repo));
		return json(fresh ? await withForceFresh(load) : await load());
	} catch (caught) {
		return apiError('repo-workflows-endpoint', caught);
	}
};
