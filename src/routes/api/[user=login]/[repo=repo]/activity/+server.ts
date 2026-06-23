import { json } from '@sveltejs/kit';
import { getActivityPage, backfillActivity } from '$lib/server/github/activity';
import { requireRepo } from '$lib/server/github/repo';
import { apiError } from '$lib/server/response';
import { logError } from '$lib/errors';
import type { RequestHandler } from './$types';

// Older pages of one repo's activity, filtered from the owner's stored timeline.
// Paging deeper lazily seeds history, the same way the user activity feed does
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
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
		const repo = await requireRepo(params.user, params.repo, locals.user?.login);
		setHeaders({
			'cache-control': repo.isPrivate ? 'private, no-store' : 'public, max-age=30'
		});
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
		return apiError('repo-activity-endpoint', caught);
	}
};
