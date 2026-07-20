import { getLifecycleActivity } from '$lib/server/github/activity';
import { userFreshEndpoint } from '$lib/server/response';

// A user's project lifecycle activity, revalidated on land for a signed-in viewer
export const GET = userFreshEndpoint('user-lifecycle-endpoint', getLifecycleActivity);
