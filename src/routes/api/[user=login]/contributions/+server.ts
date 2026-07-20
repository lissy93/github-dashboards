import { getUserContributions } from '$lib/server/github/user-stats';
import { userFreshEndpoint } from '$lib/server/response';

// A user's contribution history, revalidated on land for a signed-in viewer
export const GET = userFreshEndpoint('user-contributions-endpoint', getUserContributions);
