import { getRepoIssuesAll, isRepoIssuesAllCached } from '$lib/server/github/repo-tasks';
import { getRepoIssuePrTimeline, isRepoTimelineCached } from '$lib/server/github/repo-timeline';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Render inline when the list and chart are already warm, stream only a cold first fetch
export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const issues = settle('repo-issues', getRepoIssuesAll(params.user, params.repo));
	const timeline = settle('repo-timeline', getRepoIssuePrTimeline(params.user, params.repo));
	const [ready, timelineReady] = await Promise.all([
		isRepoIssuesAllCached(params.user, params.repo),
		isRepoTimelineCached(params.user, params.repo)
	]);
	return {
		issues: ready ? await issues : issues,
		timeline: timelineReady ? await timeline : timeline
	};
};
