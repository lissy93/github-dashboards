import { getRepoCommitGraph } from '$lib/server/github/repo-commits';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const graph = settle('repo-commit-graph', getRepoCommitGraph(params.user, params.repo));
	return inlineReady({ graph }, isDataRequest);
};
