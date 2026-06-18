import { json } from '@sveltejs/kit';
import { getTaskData } from '$lib/server/github/tasks';
import { logError } from '$lib/errors';
import type { TaskData } from '$lib/types';
import type { RequestHandler } from './$types';

const emptyList = { items: [], total: 0, capped: false };

// Open items for a user, cached server-side. Falls back to empty buckets on failure
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=60' });
	try {
		return json(await getTaskData(params.user));
	} catch (caught) {
		logError('task-endpoint', caught);
		const data: TaskData = {
			login: params.user,
			isOrg: false,
			buckets: {
				reviewPrs: emptyList,
				myPrs: emptyList,
				reviewIssues: emptyList,
				myIssues: emptyList
			}
		};
		return json(data);
	}
};
