import { getTaskData, isTaskReady } from '$lib/server/github/tasks';
import { logError, toDisplayError } from '$lib/errors';
import { BUCKET_BY_SECTION, TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
import type { TaskList } from '$lib/types';
import type { PageServerLoad } from './$types';

export type TaskListResult =
	| { ok: true; list: TaskList }
	| { ok: false; error: { title: string; message: string } };

export const load: PageServerLoad = async ({ params }) => {
	// The matcher guarantees a known section, so the bucket always resolves
	const bucket = BUCKET_BY_SECTION[params.list];

	const result: Promise<TaskListResult> = getTaskData(params.user)
		.then((data) => ({ ok: true as const, list: data.buckets[bucket] }))
		.catch((caught) => {
			logError('task-list', caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});

	const ready = await isTaskReady(params.user);
	return {
		user: params.user,
		bucket,
		title: TASK_BUCKETS[bucket].title,
		result: ready ? await result : result
	};
};
