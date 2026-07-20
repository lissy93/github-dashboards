import { getRepoCommitGraph } from '$lib/server/github/repo-commits';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo commit and branch history graph, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-commit-graph-endpoint', getRepoCommitGraph);
