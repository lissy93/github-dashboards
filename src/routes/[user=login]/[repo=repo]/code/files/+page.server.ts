import { getRepoTree } from '$lib/server/github/repo-tree';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// The tree streams in so a large repo never blocks the page render
export const load: PageServerLoad = ({ params }) => ({
	tree: settle('repo-tree', getRepoTree(params.user, params.repo))
});
