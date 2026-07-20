import { getRepoStarHistory } from '$lib/server/github/star-history';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo star history curve, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-star-history-endpoint', getRepoStarHistory);
