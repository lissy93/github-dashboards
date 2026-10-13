import { getRepoWorkflows, getRepoRunActivity } from '$lib/server/github/workflows';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const { user, repo } = params;
	const workflows = settle('repo-workflows', getRepoWorkflows(user, repo));
	const runs = settle('repo-run-activity', getRepoRunActivity(user, repo));
	return inlineReady({ workflows, runs }, isDataRequest);
};
