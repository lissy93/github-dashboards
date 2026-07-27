import { getUserOverview, isUserOverviewCached } from '$lib/server/github/user';
import { getTaskData, isTaskReady } from '$lib/server/github/tasks';
import { getActivityPage } from '$lib/server/github/activity';
import { getAuthoredContributions } from '$lib/server/github/authored-contributions';
import { isAuthoredTimelineCached } from '$lib/server/github/authored-timeline';
import { canSeeTraffic } from '$lib/server/github/traffic';
import { settle } from '$lib/server/load';
import {
	previewBuckets,
	OVERVIEW_TASK_PREVIEW,
	OVERVIEW_ACTIVITY_PREVIEW,
	type ActivityResult
} from '$lib/views/overview';
import type { AuthoredContributions, LoadResult } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
	const user = params.user;
	const { isOrg } = await parent();

	// Each dataset carries its error as data so one failure never breaks the rest
	const overview = settle('overview', getUserOverview(user));
	const task = settle(
		'overview-task',
		getTaskData(user).then((data) => previewBuckets(data, OVERVIEW_TASK_PREVIEW))
	);

	// Activity is a quick store read, resolve it inline and never block on GitHub here
	const activity: ActivityResult | null = isOrg
		? null
		: await settle(
				'overview-activity',
				getActivityPage(user, { limit: OVERVIEW_ACTIVITY_PREVIEW }).then((page) => page.events)
			);

	// Render cached data server-side for SEO, stream only a slow cold miss
	const [overviewReady, taskReady, contribReady] = await Promise.all([
		isUserOverviewCached(user),
		isTaskReady(user),
		isAuthoredTimelineCached(user)
	]);

	// Reduce the authored crawl only when it is already warm, a cold crawl is heavy so the
	// signed-in viewer warms it from the client instead of blocking every overview visit
	const contributions: LoadResult<AuthoredContributions> | null = isOrg
		? null
		: contribReady
			? await settle('overview-contributions', getAuthoredContributions(user))
			: { ok: true, data: { years: [], complete: false } };

	return {
		user,
		isOrg,
		canSeeTraffic: canSeeTraffic(user, locals.user?.login),
		overview: overviewReady ? await overview : overview,
		task: taskReady ? await task : task,
		activity,
		contributions
	};
};
