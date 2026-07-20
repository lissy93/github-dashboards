import { getUserOverview } from '$lib/server/github/user';
import { userFreshEndpoint } from '$lib/server/response';

// User or org profile and repo list, revalidated on land for a signed-in viewer
export const GET = userFreshEndpoint('user-overview-endpoint', getUserOverview);
