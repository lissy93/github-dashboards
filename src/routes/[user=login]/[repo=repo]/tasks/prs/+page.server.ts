import { getRepoPullRequestsAll, isRepoPullRequestsAllCached } from '$lib/server/github/repo-tasks';
import { getRepoIssuePrTimeline, isRepoTimelineCached } from '$lib/server/github/repo-timeline';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Render inline when the list and chart are already warm, stream only a cold first fetch
export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const prs = settle('repo-prs', getRepoPullRequestsAll(params.user, params.repo));
	const timeline = settle('repo-timeline', getRepoIssuePrTimeline(params.user, params.repo));
	const [ready, timelineReady] = await Promise.all([
		isRepoPullRequestsAllCached(params.user, params.repo),
		isRepoTimelineCached(params.user, params.repo)
	]);
	return {
		prs: ready ? await prs : prs,
		timeline: timelineReady ? await timeline : timeline
	};
};
