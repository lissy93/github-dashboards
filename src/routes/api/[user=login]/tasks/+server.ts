import { json } from '@sveltejs/kit';
import { getTaskData, getTaskList, type TaskState } from '$lib/server/github/tasks';
import { TASK_BUCKET_INFO } from '$lib/config/tasks';
import { previewBuckets } from '$lib/views/overview';
import { withForceFresh, type FreshMode } from '$lib/server/cache';
import { apiError } from '$lib/server/response';
import type { TaskBucket } from '$lib/types';
import type { RequestHandler } from './$types';

// Signed-in viewers freshen on land with fresh=1, and refresh=1 refetches even unexpired lists
function freshMode(url: URL, signedIn: boolean): FreshMode | undefined {
	if (!signedIn) return undefined;
	if (url.searchParams.has('refresh')) return 'all';
	return url.searchParams.has('fresh') ? 'stale' : undefined;
}

// User review queues: bucket= one list (state=closed for its history), preview= every bucket trimmed
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const fresh = freshMode(url, !!locals.user);
	const preview = Number(url.searchParams.get('preview')) || 0;
	const bucket = url.searchParams.get('bucket') as TaskBucket | null;
	const state: TaskState = url.searchParams.get('state') === 'closed' ? 'closed' : 'open';
	try {
		if (bucket && TASK_BUCKET_INFO[bucket])
			return json(await getTaskList(params.user, bucket, state, fresh));
		if (bucket) return json({ items: [], total: 0, capped: false });
		const run = () => getTaskData(params.user);
		const data = fresh ? await withForceFresh(run, fresh) : await run();
		return json(preview ? previewBuckets(data, preview) : data);
	} catch (caught) {
		return apiError('task-endpoint', caught);
	}
};
