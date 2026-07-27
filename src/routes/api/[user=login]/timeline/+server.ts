import { json } from '@sveltejs/kit';
import { advanceUserTimeline, getUserIssuePrTimeline } from '$lib/server/github/user-timeline';
import { advanceAuthoredTimeline, getAuthoredTimeline } from '$lib/server/github/authored-timeline';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// The user's all-time issue/PR timeline, advancing one more batch of older history when a
// signed-in viewer asks so the charts fill in progressively and cache for everyone. scope=mine
// serves the authored contributions crawl, otherwise the on-repos review aggregate
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	try {
		// Only a signed-in viewer drives the deeper crawl, anonymous stays on the cached bound
		const advance = url.searchParams.has('advance') && !!locals.user;
		const mine = url.searchParams.get('scope') === 'mine';
		setHeaders({ 'cache-control': 'private, no-store' });
		const timeline = mine
			? advance
				? await advanceAuthoredTimeline(params.user)
				: await getAuthoredTimeline(params.user)
			: advance
				? await advanceUserTimeline(params.user)
				: await getUserIssuePrTimeline(params.user);
		return json(timeline);
	} catch (caught) {
		return apiError('user-timeline-endpoint', caught);
	}
};
