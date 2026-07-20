import { getActivityRhythm } from '$lib/server/github/activity';
import { userFreshEndpoint } from '$lib/server/response';

// A user's activity rhythm heatmap, revalidated on land for a signed-in viewer
export const GET = userFreshEndpoint('user-rhythm-endpoint', getActivityRhythm);
