import { json } from '@sveltejs/kit';
import { advanceUserTimeline, getUserIssuePrTimeline } from '$lib/server/github/user-timeline';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// The user's all-time issue/PR timeline across their repos, advancing one more repo's
// history when a signed-in viewer asks, so the charts fill in progressively and the
// aggregate caches for everyone
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	try {
		// Only a signed-in viewer drives the deeper crawl, anonymous stays on the cached bound
		const advance = url.searchParams.has('advance') && !!locals.user;
		setHeaders({ 'cache-control': 'private, no-store' });
		const timeline = advance
			? await advanceUserTimeline(params.user)
			: await getUserIssuePrTimeline(params.user);
		return json(timeline);
	} catch (caught) {
		return apiError('user-timeline-endpoint', caught);
	}
};
