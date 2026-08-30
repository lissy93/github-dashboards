import { getTaskList, isTaskListCached } from '$lib/server/github/tasks';
import { getUserIssuePrTimeline, isUserTimelineCached } from '$lib/server/github/user-timeline';
import {
	getAuthoredTimeline,
	isAuthoredTimelineCached
} from '$lib/server/github/authored-timeline';
import { settle } from '$lib/server/load';
import { BUCKET_BY_SECTION, TASK_BUCKET_INFO } from '$lib/config/tasks';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// The matcher guarantees a known section, so the bucket always resolves
	const bucket = BUCKET_BY_SECTION[params.list];
	const { mine, title } = TASK_BUCKET_INFO[bucket];

	const result = settle('task-list', getTaskList(params.user, bucket));
	// The authored lists chart the user's own contributions, the review lists the on-repos totals
	const timeline = settle(
		'user-timeline',
		mine ? getAuthoredTimeline(params.user) : getUserIssuePrTimeline(params.user)
	);

	const [ready, timelineReady] = await Promise.all([
		isTaskListCached(params.user, bucket),
		mine ? isAuthoredTimelineCached(params.user) : isUserTimelineCached(params.user)
	]);
	return {
		user: params.user,
		bucket,
		mine,
		title,
		result: ready ? await result : result,
		timeline: timelineReady ? await timeline : timeline
	};
};
