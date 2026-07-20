import { getOwnedLanguages } from '$lib/server/github/languages';
import { userFreshEndpoint } from '$lib/server/response';

// Aggregate language breakdown across a user's repos, revalidated on land
export const GET = userFreshEndpoint('user-languages-endpoint', getOwnedLanguages);
