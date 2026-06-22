import { getRepoWorkflows, isRepoWorkflowsCached } from '$lib/server/github/workflows';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const workflows = settle('repo-workflows', getRepoWorkflows(params.user, params.repo));
	const ready = await isRepoWorkflowsCached(params.user, params.repo);
	return { workflows: ready ? await workflows : workflows };
};
