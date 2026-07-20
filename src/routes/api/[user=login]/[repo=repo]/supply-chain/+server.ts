import { getSupplyChain } from '$lib/server/github/supply-chain';
import { repoFreshEndpoint } from '$lib/server/response';

// Repo dependencies and licences, revalidated on land for a signed-in viewer
export const GET = repoFreshEndpoint('repo-supply-chain-endpoint', getSupplyChain);
