import { getRepoTree, isRepoTreeCached } from '$lib/server/github/repo-tree';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Render inline when the tree is already cached, stream only a cold miss
export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const tree = settle('repo-tree', getRepoTree(params.user, params.repo));
	const ready = await isRepoTreeCached(params.user, params.repo);
	return { tree: ready ? await tree : tree };
};
