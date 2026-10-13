import { getRepoTree } from '$lib/server/github/repo-tree';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const tree = settle('repo-tree', getRepoTree(params.user, params.repo));
	return inlineReady({ tree }, isDataRequest);
};
