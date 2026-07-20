import { getRepoIssues } from '$lib/server/github/repo-tasks';
import { repoFreshEndpoint } from '$lib/server/response';

// Open issues list, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-issues-endpoint', getRepoIssues);
