import { json } from '@sveltejs/kit';
import { getActivityPage, backfillActivity } from '$lib/server/github/activity';
import { logError } from '$lib/errors';
import type { RequestHandler } from './$types';

// Older pages of one repo's activity, filtered from the owner's stored timeline.
// Paging deeper lazily seeds history, the same way the user activity feed does
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=30' });
	const user = params.user;
	const cursor = url.searchParams.get('cursor');
	const options = {
		cursor,
		repo: `${params.user}/${params.repo}`,
		type: url.searchParams.get('type'),
		q: url.searchParams.get('q'),
		dir: url.searchParams.get('dir')
	};
	const seed = () =>
		backfillActivity(user).catch((caught) => logError('repo-activity-backfill', caught));

	try {
		let page = await getActivityPage(user, options);
		if (cursor) {
			if (page.nextCursor) void seed();
			else {
				await seed();
				page = await getActivityPage(user, options);
			}
		}
		return json(page);
	} catch (caught) {
		logError('repo-activity-endpoint', caught);
		return json({ events: [], nextCursor: null });
	}
};
