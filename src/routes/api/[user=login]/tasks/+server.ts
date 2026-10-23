import { json } from '@sveltejs/kit';
import { getTaskData, getTaskList } from '$lib/server/github/tasks';
import { TASK_BUCKET_INFO } from '$lib/config/tasks';
import { previewBuckets } from '$lib/views/overview';
import { withForceFresh } from '$lib/server/cache';
import { apiError } from '$lib/server/response';
import type { TaskBucket } from '$lib/types';
import type { RequestHandler } from './$types';

// User review queues, fresh on land for a signed-in viewer. bucket= is one open list,
// preview= trims every bucket, neither is the lot
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const fresh = url.searchParams.has('fresh') && !!locals.user;
	const preview = Number(url.searchParams.get('preview')) || 0;
	const bucket = url.searchParams.get('bucket') as TaskBucket | null;
	try {
		// Only the open half revalidates, the page streams closed history in separately
		if (bucket && TASK_BUCKET_INFO[bucket])
			return json(await getTaskList(params.user, bucket, fresh));
		if (bucket) return json({ items: [], total: 0, capped: false });
		const run = () => getTaskData(params.user);
		const data = fresh ? await withForceFresh(run) : await run();
		return json(preview ? previewBuckets(data, preview) : data);
	} catch (caught) {
		return apiError('task-endpoint', caught);
	}
};
