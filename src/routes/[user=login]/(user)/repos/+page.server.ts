import { getUserOverview, isUserOverviewCached } from '$lib/server/github/user';
import { canSeeTraffic } from '$lib/server/github/traffic';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// Errors travel as data so their message survives a streamed response
	const result = settle('user-repos', getUserOverview(params.user));

	// Render cached lists server-side for SEO, stream only a slow cold miss
	const cachedAlready = await isUserOverviewCached(params.user);
	return {
		user: params.user,
		canSeeTraffic: canSeeTraffic(params.user, locals.user?.login),
		result: cachedAlready ? await result : result
	};
};
