import { getRepoRecentCommits } from '$lib/server/github/repo-metrics';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo recent-commit KPI window, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-recent-commits-endpoint', getRepoRecentCommits);
