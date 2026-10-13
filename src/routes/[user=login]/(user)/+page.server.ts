import { getUserOverview } from '$lib/server/github/user';
import { getTaskData } from '$lib/server/github/tasks';
import { getActivityPage } from '$lib/server/github/activity';
import { getAuthoredContributions } from '$lib/server/github/authored-contributions';
import { isAuthoredTimelineCached } from '$lib/server/github/authored-timeline';
import { canSeeTraffic } from '$lib/server/github/traffic';
import { inlineReady, settle } from '$lib/server/load';
import {
	previewBuckets,
	OVERVIEW_TASK_PREVIEW,
	OVERVIEW_ACTIVITY_PREVIEW,
	type ActivityResult
} from '$lib/views/overview';
import type { AuthoredContributions, LoadResult } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals, isDataRequest }) => {
	const user = params.user;
	const { isOrg } = await parent();

	// Each dataset carries its error as data so one failure never breaks the rest
	const overview = settle('overview', getUserOverview(user));
	const task = settle(
		'overview-task',
		getTaskData(user).then((data) => previewBuckets(data, OVERVIEW_TASK_PREVIEW))
	);

	// Activity is a quick store read, never block on GitHub here
	const activity: Promise<ActivityResult> | null = isOrg
		? null
		: settle(
				'overview-activity',
				getActivityPage(user, { limit: OVERVIEW_ACTIVITY_PREVIEW }).then((page) => page.events)
			);

	// Reduce the authored crawl only when it is already warm, a cold crawl is heavy so the
	// signed-in viewer warms it from the client instead of blocking every overview visit
	const contributions: Promise<LoadResult<AuthoredContributions>> | null = isOrg
		? null
		: isAuthoredTimelineCached(user).then((warm) =>
				warm
					? settle('overview-contributions', getAuthoredContributions(user))
					: { ok: true, data: { years: [], complete: false } }
			);

	return inlineReady(
		{
			user,
			isOrg,
			canSeeTraffic: canSeeTraffic(user, locals.user?.login),
			overview,
			task,
			activity,
			contributions
		},
		isDataRequest
	);
};
