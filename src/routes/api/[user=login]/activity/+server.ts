import { json } from '@sveltejs/kit';
import { getActivityPage } from '$lib/server/github/activity';
import { logError } from '$lib/errors';
import type { RequestHandler } from './$types';

// Older pages of the activity timeline, read straight from the store, no GitHub calls
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=30' });
	try {
		const page = await getActivityPage(params.user, {
			cursor: url.searchParams.get('cursor'),
			type: url.searchParams.get('type'),
			q: url.searchParams.get('q'),
			dir: url.searchParams.get('dir')
		});
		return json(page);
	} catch (caught) {
		logError('activity-endpoint', caught);
		return json({ events: [], nextCursor: null });
	}
};
