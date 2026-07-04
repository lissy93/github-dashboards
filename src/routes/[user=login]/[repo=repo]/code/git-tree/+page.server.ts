import { getRepoCommitGraph, isRepoCommitGraphCached } from '$lib/server/github/repo-commits';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Render inline when the graph is already cached, stream only a cold miss
export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const graph = settle('repo-commit-graph', getRepoCommitGraph(params.user, params.repo));
	const ready = await isRepoCommitGraphCached(params.user, params.repo);
	return { graph: ready ? await graph : graph };
};
