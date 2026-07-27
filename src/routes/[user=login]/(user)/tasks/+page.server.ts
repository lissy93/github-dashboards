import { getTaskData, isTaskReady } from '$lib/server/github/tasks';
import { settle } from '$lib/server/load';
import { previewBuckets, TASKS_SUMMARY_PREVIEW } from '$lib/views/overview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// Refresh from GitHub best-effort, falling back to a display error if it throws
	const result = settle(
		'task',
		getTaskData(params.user).then((data) => previewBuckets(data, TASKS_SUMMARY_PREVIEW))
	);

	// Render inline once seeded for SEO, stream only the cold first build
	const ready = await isTaskReady(params.user);
	return { user: params.user, result: ready ? await result : result };
};
