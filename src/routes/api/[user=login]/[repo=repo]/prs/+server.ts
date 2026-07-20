import { getRepoPullRequests } from '$lib/server/github/repo-tasks';
import { repoFreshEndpoint } from '$lib/server/response';

// Open pull requests list, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-prs-endpoint', getRepoPullRequests);
