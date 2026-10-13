import { getTaskData } from '$lib/server/github/tasks';
import { getUserIssuePrTimeline } from '$lib/server/github/user-timeline';
import { getAuthoredTimeline } from '$lib/server/github/authored-timeline';
import { inlineReady, settle } from '$lib/server/load';
import { previewBuckets, TASKS_SUMMARY_PREVIEW } from '$lib/views/overview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals, isDataRequest }) => {
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
	return inlineReady({ user: params.user, mine, result, timeline }, isDataRequest);
};
