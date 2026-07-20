import { getRepoLanguages } from '$lib/server/github/languages';
import { userFreshEndpoint } from '$lib/server/response';

// Per-repo language bytes for the per-year split, revalidated on land
export const GET = userFreshEndpoint('user-repo-languages-endpoint', getRepoLanguages);
