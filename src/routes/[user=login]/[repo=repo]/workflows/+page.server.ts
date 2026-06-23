import {
	getRepoWorkflows,
	getRepoRunActivity,
	isRepoWorkflowsCached
} from '$lib/server/github/workflows';
import { getRepoDeployments, isRepoDeploymentsCached } from '$lib/server/github/deployments';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { user, repo } = params;
	const workflows = settle('repo-workflows', getRepoWorkflows(user, repo));
	const runs = settle('repo-run-activity', getRepoRunActivity(user, repo));
	const deployments = settle('repo-deployments', getRepoDeployments(user, repo));

	const [wfReady, depReady] = await Promise.all([
		isRepoWorkflowsCached(user, repo),
		isRepoDeploymentsCached(user, repo)
	]);

	return {
		workflows: wfReady ? await workflows : workflows,
		runs,
		deployments: depReady ? await deployments : deployments
	};
};
