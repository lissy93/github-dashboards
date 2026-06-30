import { getRepoCommitGraph } from '$lib/server/github/repo-commits';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// The history graph streams in so a deep repo never blocks the page render
export const load: PageServerLoad = ({ params }) => ({
	graph: settle('repo-commit-graph', getRepoCommitGraph(params.user, params.repo))
});
