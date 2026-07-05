import { json } from '@sveltejs/kit';
import { advanceRepoTimeline, getRepoIssuePrTimeline } from '$lib/server/github/repo-timeline';
import { requireRepo } from '$lib/server/github/repo';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// The issue/PR timeline, advancing the older-history backfill one chunk when a signed-in
// viewer asks, so the charts fill in progressively and the deeper state caches for everyone
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	try {
		await requireRepo(params.user, params.repo, locals.user?.login);
		// Only a signed-in viewer drives the deeper crawl, anonymous stays on the background bound
		const advance = url.searchParams.has('advance') && !!locals.user;
		setHeaders({ 'cache-control': 'private, no-store' });
		const timeline = advance
			? await advanceRepoTimeline(params.user, params.repo)
			: await getRepoIssuePrTimeline(params.user, params.repo);
		return json(timeline);
	} catch (caught) {
		return apiError('repo-timeline-endpoint', caught);
	}
};
