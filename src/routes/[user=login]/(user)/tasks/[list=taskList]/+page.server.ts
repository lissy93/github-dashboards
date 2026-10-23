import { getClosedTaskList, getTaskList } from '$lib/server/github/tasks';
import { getUserIssuePrTimeline } from '$lib/server/github/user-timeline';
import { getAuthoredTimeline } from '$lib/server/github/authored-timeline';
import { inlineReady, settle } from '$lib/server/load';
import { BUCKET_BY_SECTION, TASK_BUCKET_INFO } from '$lib/config/tasks';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, isDataRequest }) => {
	// The matcher guarantees a known section, so the bucket always resolves
	const bucket = BUCKET_BY_SECTION[params.list];
	const { mine, title } = TASK_BUCKET_INFO[bucket];

	const result = settle('task-list', getTaskList(params.user, bucket));
	// Closed history is the slow half, so it streams in apart from the open list
	const closed = settle('task-list-closed', getClosedTaskList(params.user, bucket));
	// The authored lists chart the user's own contributions, the review lists the on-repos totals
	const timeline = settle(
		'user-timeline',
		mine ? getAuthoredTimeline(params.user) : getUserIssuePrTimeline(params.user)
	);
	return inlineReady(
		{ user: params.user, bucket, mine, title, result, closed, timeline },
		isDataRequest
	);
};
