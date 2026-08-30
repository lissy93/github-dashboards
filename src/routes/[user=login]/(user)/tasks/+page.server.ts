import { getTaskData, isTaskReady } from '$lib/server/github/tasks';
import { getUserIssuePrTimeline, isUserTimelineCached } from '$lib/server/github/user-timeline';
import {
	getAuthoredTimeline,
	isAuthoredTimelineCached
} from '$lib/server/github/authored-timeline';
import { settle } from '$lib/server/load';
import { previewBuckets, TASKS_SUMMARY_PREVIEW } from '$lib/views/overview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
	const { isOrg } = await parent();
	// Non-owners see the authored lists, so chart that same authored work
	const mine = !isOrg && locals.user?.login.toLowerCase() !== params.user.toLowerCase();

	// Refresh from GitHub best-effort, falling back to a display error if it throws
	const result = settle(
		'task',
		getTaskData(params.user).then((data) => previewBuckets(data, TASKS_SUMMARY_PREVIEW))
	);
	const timeline = settle(
		'user-timeline',
		mine ? getAuthoredTimeline(params.user) : getUserIssuePrTimeline(params.user)
	);

	// Render inline once seeded for SEO, stream only the cold first build
	const [ready, timelineReady] = await Promise.all([
		isTaskReady(params.user),
		mine ? isAuthoredTimelineCached(params.user) : isUserTimelineCached(params.user)
	]);
	return {
		user: params.user,
		mine,
		result: ready ? await result : result,
		timeline: timelineReady ? await timeline : timeline
	};
};
