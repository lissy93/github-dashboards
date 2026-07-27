import { getTaskData, isTaskReady } from '$lib/server/github/tasks';
import { getUserIssuePrTimeline, isUserTimelineCached } from '$lib/server/github/user-timeline';
import { settle } from '$lib/server/load';
import { BUCKET_BY_SECTION, TASK_BUCKET_INFO } from '$lib/config/tasks';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// The matcher guarantees a known section, so the bucket always resolves
	const bucket = BUCKET_BY_SECTION[params.list];

	const result = settle(
		'task-list',
		getTaskData(params.user).then((data) => data.buckets[bucket])
	);
	const timeline = settle('user-timeline', getUserIssuePrTimeline(params.user));

	const [ready, timelineReady] = await Promise.all([
		isTaskReady(params.user),
		isUserTimelineCached(params.user)
	]);
	return {
		user: params.user,
		bucket,
		title: TASK_BUCKET_INFO[bucket].title,
		result: ready ? await result : result,
		timeline: timelineReady ? await timeline : timeline
	};
};
