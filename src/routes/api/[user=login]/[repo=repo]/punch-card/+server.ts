import { getRepoPunchCard } from '$lib/server/github/repo-metrics';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo commit punch card, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-punch-card-endpoint', getRepoPunchCard);
