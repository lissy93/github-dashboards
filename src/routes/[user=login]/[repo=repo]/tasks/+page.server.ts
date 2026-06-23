import { getRepoTasks, isRepoTasksCached } from '$lib/server/github/repo-tasks';
import { getRepoIssuePrTimeline, isRepoTimelineCached } from '$lib/server/github/repo-timeline';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// The open lists and the total charts stream independently, each awaited inline only when
// it is already cached so the first paint carries whatever is ready
export const load: PageServerLoad = async ({ params }) => {
	const tasks = settle('repo-tasks', getRepoTasks(params.user, params.repo));
	const timeline = settle('repo-timeline', getRepoIssuePrTimeline(params.user, params.repo));
	const [tasksReady, timelineReady] = await Promise.all([
		isRepoTasksCached(params.user, params.repo),
		isRepoTimelineCached(params.user, params.repo)
	]);
	return {
		tasks: tasksReady ? await tasks : tasks,
		timeline: timelineReady ? await timeline : timeline
	};
};
