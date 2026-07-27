import { getRepoIssuesAll } from '$lib/server/github/repo-tasks';
import { repoFreshEndpoint } from '$lib/server/response';

// Open plus recent closed issues, fresh on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-issues-endpoint', getRepoIssuesAll);
