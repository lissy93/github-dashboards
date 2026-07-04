import {
	getRepoWorkflows,
	getRepoRunActivity,
	isRepoWorkflowsCached
} from '$lib/server/github/workflows';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const { user, repo } = params;
	const workflows = settle('repo-workflows', getRepoWorkflows(user, repo));
	const runs = settle('repo-run-activity', getRepoRunActivity(user, repo));
	const ready = await isRepoWorkflowsCached(user, repo);

	return {
		workflows: ready ? await workflows : workflows,
		runs
	};
};
