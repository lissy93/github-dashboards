import { json } from '@sveltejs/kit';
import { advanceRepoReleases, getRepoReleases } from '$lib/server/github/releases';
import { requireRepo } from '$lib/server/github/repo';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Release history, walking one more chunk of older pages when a signed-in viewer
// asks, so the table fills in progressively and the deeper state caches for everyone
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	try {
		await requireRepo(params.user, params.repo, locals.user?.login);
		// Only a signed-in viewer drives the deeper crawl, anonymous stays on the background bound
		const advance = url.searchParams.has('advance') && !!locals.user;
		setHeaders({ 'cache-control': 'private, no-store' });
		const releases = advance
			? await advanceRepoReleases(params.user, params.repo)
			: await getRepoReleases(params.user, params.repo);
		return json(releases);
	} catch (caught) {
		return apiError('repo-releases-endpoint', caught);
	}
};
