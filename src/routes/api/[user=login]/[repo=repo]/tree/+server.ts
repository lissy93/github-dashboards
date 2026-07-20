import { getRepoTree } from '$lib/server/github/repo-tree';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo file tree, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-tree-endpoint', getRepoTree);
