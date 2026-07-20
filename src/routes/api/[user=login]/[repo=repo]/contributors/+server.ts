import { getRepoContributors } from '$lib/server/github/contributors';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo contributor leaderboard, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-contributors-endpoint', getRepoContributors);
