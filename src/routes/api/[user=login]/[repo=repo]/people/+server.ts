import { getRepoPeople } from '$lib/server/github/repo-people';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo audience (stargazers, forks, watchers), revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-people-endpoint', getRepoPeople);
