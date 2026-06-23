import {
	getRepoWorkflows,
	getRepoRunActivity,
	isRepoWorkflowsCached
} from '$lib/server/github/workflows';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { user, repo } = params;
	const workflows = settle('repo-workflows', getRepoWorkflows(user, repo));
	const runs = settle('repo-run-activity', getRepoRunActivity(user, repo));
	const ready = await isRepoWorkflowsCached(user, repo);

	return {
		workflows: ready ? await workflows : workflows,
		runs
	};
};
