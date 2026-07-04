import { json } from '@sveltejs/kit';
import { getTaskData } from '$lib/server/github/tasks';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Open items for a user, cached server-side
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=60' });
	try {
		return json(await getTaskData(params.user));
	} catch (caught) {
		return apiError('task-endpoint', caught);
	}
};
