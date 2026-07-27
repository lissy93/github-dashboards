import { getRepoPullRequestsAll } from '$lib/server/github/repo-tasks';
import { repoFreshEndpoint } from '$lib/server/response';

// Open plus recent closed/merged PRs, fresh on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-prs-endpoint', getRepoPullRequestsAll);
