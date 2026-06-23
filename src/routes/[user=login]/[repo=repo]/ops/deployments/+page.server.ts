import { getRepoDeployments, isRepoDeploymentsCached } from '$lib/server/github/deployments';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { user, repo } = params;
	const deployments = settle('repo-deployments', getRepoDeployments(user, repo));
	const ready = await isRepoDeploymentsCached(user, repo);

	return { deployments: ready ? await deployments : deployments };
};
