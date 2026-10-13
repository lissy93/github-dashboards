import { getRepoWorkflows } from '$lib/server/github/workflows';
import { getRepoDeployments } from '$lib/server/github/deployments';
import { getRepoPages } from '$lib/server/github/pages';
import { getRepoReleases } from '$lib/server/github/releases';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const { user, repo } = params;
	return inlineReady(
		{
			workflows: settle('repo-workflows', getRepoWorkflows(user, repo)),
			deployments: settle('repo-deployments', getRepoDeployments(user, repo)),
			pages: settle('repo-pages', getRepoPages(user, repo)),
			releases: settle('repo-releases', getRepoReleases(user, repo))
		},
		isDataRequest
	);
};
