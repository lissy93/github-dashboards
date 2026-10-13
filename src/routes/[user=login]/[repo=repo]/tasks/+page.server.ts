import { getRepoTasks } from '$lib/server/github/repo-tasks';
import { getRepoIssuePrTimeline } from '$lib/server/github/repo-timeline';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// The open lists and the total charts stream independently, first paint carries whatever's ready
export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const tasks = settle('repo-tasks', getRepoTasks(params.user, params.repo));
	const timeline = settle('repo-timeline', getRepoIssuePrTimeline(params.user, params.repo));
	return inlineReady({ tasks, timeline }, isDataRequest);
};
