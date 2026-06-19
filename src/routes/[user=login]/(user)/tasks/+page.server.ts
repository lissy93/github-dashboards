import { getTaskData, isTaskReady } from '$lib/server/github/tasks';
import { settle } from '$lib/server/load';
import { previewBuckets } from '$lib/views/overview';
import type { PageServerLoad } from './$types';

// This page previews each bucket, so ship a few rows but keep the real totals
const PREVIEW = 6;

export const load: PageServerLoad = async ({ params }) => {
	// Refresh from GitHub best-effort, falling back to a display error if it throws
	const result = settle(
		'task',
		getTaskData(params.user).then((data) => previewBuckets(data, PREVIEW))
	);

	// Render inline once seeded for SEO, stream only the cold first build
	const ready = await isTaskReady(params.user);
	return { user: params.user, result: ready ? await result : result };
};
