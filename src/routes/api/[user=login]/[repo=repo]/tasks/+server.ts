import { getRepoTasks } from '$lib/server/github/repo-tasks';
import { repoFreshEndpoint } from '$lib/server/response';

// Open and closed issue and PR lists, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-tasks-endpoint', getRepoTasks);
