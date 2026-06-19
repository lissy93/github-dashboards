import { getUserOverview, isUserOverviewCached } from '$lib/server/github/user';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// Errors travel as data so their message survives a streamed response
	const result = settle('user-repos', getUserOverview(params.user));

	// Render cached lists server-side for SEO, stream only a slow cold miss
	const cachedAlready = await isUserOverviewCached(params.user);
	return {
		user: params.user,
		result: cachedAlready ? await result : result
	};
};
