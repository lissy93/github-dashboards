import { getRepoIssuesAll, isRepoIssuesAllCached } from '$lib/server/github/repo-tasks';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Render inline when both lists are already warm, stream only a cold first fetch
export const load: PageServerLoad = async ({ params }) => {
	const issues = settle('repo-issues', getRepoIssuesAll(params.user, params.repo));
	const ready = await isRepoIssuesAllCached(params.user, params.repo);
	return { issues: ready ? await issues : issues };
};
