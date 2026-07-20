import { getRepoPages } from '$lib/server/github/pages';
import { repoFreshEndpoint } from '$lib/server/response';

// GitHub Pages status and build history, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-pages-endpoint', getRepoPages);
