import { getUserOverview, isUserOverviewCached } from '$lib/server/github/user';
import { getTaskData, isTaskReady } from '$lib/server/github/tasks';
import { getActivityPage } from '$lib/server/github/activity';
import { canSeeTraffic } from '$lib/server/github/traffic';
import { logError, toDisplayError } from '$lib/errors';
import {
	previewBuckets,
	type OverviewResult,
	type TaskResult,
	type ActivityResult
} from '$lib/views/overview';
import type { PageServerLoad } from './$types';

const TASK_PREVIEW = 5;
const ACTIVITY_PREVIEW = 12;

export const load: PageServerLoad = async ({ params, parent }) => {
	const user = params.user;
	const { isOrg } = await parent();

	// Each dataset carries its error as data so one failure never breaks the rest
	const overview: Promise<OverviewResult> = getUserOverview(user)
		.then((data) => ({ ok: true as const, data }))
		.catch((caught) => {
			logError('overview', caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});

	const task: Promise<TaskResult> = getTaskData(user)
		.then((data) => ({ ok: true as const, data: previewBuckets(data, TASK_PREVIEW) }))
		.catch((caught) => {
			logError('overview-task', caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});

	// Activity is a quick store read, resolve it inline and never block on GitHub here
	const activity: ActivityResult | null = isOrg
		? null
		: await getActivityPage(user, { limit: ACTIVITY_PREVIEW })
				.then((page) => ({ ok: true as const, data: page.events }))
				.catch((caught) => {
					logError('overview-activity', caught);
					return { ok: false as const, error: toDisplayError(caught) };
				});

	// Render cached data server-side for SEO, stream only a slow cold miss
	const [overviewReady, taskReady] = await Promise.all([
		isUserOverviewCached(user),
		isTaskReady(user)
	]);

	return {
		user,
		isOrg,
		canSeeTraffic: canSeeTraffic(user),
		overview: overviewReady ? await overview : overview,
		task: taskReady ? await task : task,
		activity
	};
};
