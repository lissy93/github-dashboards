import { getRepoWorkflows, isRepoWorkflowsCached } from '$lib/server/github/workflows';
import { getRepoDeployments, isRepoDeploymentsCached } from '$lib/server/github/deployments';
import { getRepoPages, isRepoPagesCached } from '$lib/server/github/pages';
import { getRepoReleases, isRepoReleasesCached } from '$lib/server/github/releases';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { user, repo } = params;

	const workflows = settle('repo-workflows', getRepoWorkflows(user, repo));
	const deployments = settle('repo-deployments', getRepoDeployments(user, repo));
	const pages = settle('repo-pages', getRepoPages(user, repo));
	const releases = settle('repo-releases', getRepoReleases(user, repo));

	const [wfReady, depReady, pgReady, relReady] = await Promise.all([
		isRepoWorkflowsCached(user, repo),
		isRepoDeploymentsCached(user, repo),
		isRepoPagesCached(user, repo),
		isRepoReleasesCached(user, repo)
	]);

	return {
		workflows: wfReady ? await workflows : workflows,
		deployments: depReady ? await deployments : deployments,
		pages: pgReady ? await pages : pages,
		releases: relReady ? await releases : releases
	};
};
