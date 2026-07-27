import { json } from '@sveltejs/kit';
import { getActivityPage, backfillActivity, syncActivity } from '$lib/server/github/activity';
import { apiError } from '$lib/server/response';
import { withForceFresh } from '$lib/server/cache';
import { logError } from '$lib/utils/errors';
import type { RequestHandler } from './$types';

// Older pages of the activity timeline, served from the store. Reaching here means
// the user is scrolling, so we lazily seed deep history (cached, so once a day)
export const GET: RequestHandler = async ({ params, url, locals, setHeaders }) => {
	const user = params.user;
	const cursor = url.searchParams.get('cursor');
	const fresh = url.searchParams.has('fresh') && !!locals.user;
	setHeaders({ 'cache-control': fresh ? 'private, no-store' : 'public, max-age=30' });
	const limit = Number(url.searchParams.get('limit')) || undefined;
	const options = {
		cursor,
		limit,
		type: url.searchParams.get('type'),
		q: url.searchParams.get('q'),
		dir: url.searchParams.get('dir')
	};
	const seed = () =>
		backfillActivity(user).catch((caught) => logError('activity-backfill', caught));

	try {
		// A fresh land re-syncs the newest events before serving the first page
		if (fresh && !cursor)
			await withForceFresh(() => syncActivity(user)).catch((caught) =>
				logError('activity-sync', caught)
			);

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
