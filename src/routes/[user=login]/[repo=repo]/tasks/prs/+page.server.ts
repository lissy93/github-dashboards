import { getRepoPullRequestsAll, isRepoPullRequestsAllCached } from '$lib/server/github/repo-tasks';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Render inline when both lists are already warm, stream only a cold first fetch
export const load: PageServerLoad = async ({ params }) => {
	const prs = settle('repo-prs', getRepoPullRequestsAll(params.user, params.repo));
	const ready = await isRepoPullRequestsAllCached(params.user, params.repo);
	return { prs: ready ? await prs : prs };
};
