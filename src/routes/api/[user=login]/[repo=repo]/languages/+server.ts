import { getRepoLanguageUsage } from '$lib/server/github/languages';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo language breakdown, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-languages-endpoint', getRepoLanguageUsage);
