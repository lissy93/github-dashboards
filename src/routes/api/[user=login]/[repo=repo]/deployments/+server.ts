import { getRepoDeployments } from '$lib/server/github/deployments';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo deployments and environments, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-deployments-endpoint', getRepoDeployments);
