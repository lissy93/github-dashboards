import { getRepoLabels } from '$lib/server/github/repo-labels';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo label breakdown, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-labels-endpoint', getRepoLabels);
