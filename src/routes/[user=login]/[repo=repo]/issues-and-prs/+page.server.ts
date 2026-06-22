import { getRepoIssuePrTimeline, isRepoTimelineCached } from '$lib/server/github/repo-timeline';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const timeline = settle('repo-timeline', getRepoIssuePrTimeline(params.user, params.repo));
	const ready = await isRepoTimelineCached(params.user, params.repo);
	return { timeline: ready ? await timeline : timeline };
};
