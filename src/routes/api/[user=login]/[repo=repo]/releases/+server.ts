import { json } from '@sveltejs/kit';
import { advanceRepoReleases, getRepoReleases } from '$lib/server/github/releases';
import { requireRepo } from '$lib/server/github/repo';
import { withForceFresh } from '$lib/server/cache';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Release history. advance walks one more chunk of older pages, fresh revalidates the
// current view, both signed-in only so the deeper state caches for everyone
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	try {
		await requireRepo(params.user, params.repo, locals.user?.login);
		const advance = url.searchParams.has('advance') && !!locals.user;
		const fresh = url.searchParams.has('fresh') && !!locals.user;
		setHeaders({ 'cache-control': 'private, no-store' });
		const load = () => getRepoReleases(params.user, params.repo);
		if (advance) return json(await advanceRepoReleases(params.user, params.repo));
		return json(fresh ? await withForceFresh(load) : await load());
	} catch (caught) {
		return apiError('repo-releases-endpoint', caught);
	}
};
