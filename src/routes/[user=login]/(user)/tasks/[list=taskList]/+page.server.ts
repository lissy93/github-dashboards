import { getTaskData, isTaskReady } from '$lib/server/github/tasks';
import { settle } from '$lib/server/load';
import { BUCKET_BY_SECTION, TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// The matcher guarantees a known section, so the bucket always resolves
	const bucket = BUCKET_BY_SECTION[params.list];

	const result = settle(
		'task-list',
		getTaskData(params.user).then((data) => data.buckets[bucket])
	);

	const ready = await isTaskReady(params.user);
	return {
		user: params.user,
		bucket,
		title: TASK_BUCKETS[bucket].title,
		result: ready ? await result : result
	};
};
