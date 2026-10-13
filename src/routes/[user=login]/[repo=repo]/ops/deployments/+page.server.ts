import { getRepoDeployments } from '$lib/server/github/deployments';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const deployments = settle('repo-deployments', getRepoDeployments(params.user, params.repo));
	return inlineReady({ deployments }, isDataRequest);
};
