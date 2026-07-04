import { json } from '@sveltejs/kit';
import { getActivityPage, backfillActivity } from '$lib/server/github/activity';
import { apiError } from '$lib/server/response';
import { logError } from '$lib/utils/errors';
import type { RequestHandler } from './$types';

// Older pages of the activity timeline, served from the store. Reaching here means
// the user is scrolling, so we lazily seed deep history (cached, so once a day)
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=30' });
	const user = params.user;
	const cursor = url.searchParams.get('cursor');
	const options = {
		cursor,
		type: url.searchParams.get('type'),
		q: url.searchParams.get('q'),
		dir: url.searchParams.get('dir')
	};
	const seed = () =>
		backfillActivity(user).catch((caught) => logError('activity-backfill', caught));

	try {
		let page = await getActivityPage(user, options);
		// Only seed once the user pages past the first screen. Block on it when stored
		// data runs out, so the timeline never ends before history has loaded
		if (cursor) {
			if (page.nextCursor) void seed();
			else {
				await seed();
				page = await getActivityPage(user, options);
			}
		}
		return json(page);
	} catch (caught) {
		return apiError('activity-endpoint', caught);
	}
};
