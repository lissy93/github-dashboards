import { getUserOverview } from '$lib/server/github/user';
import { canSeeTraffic } from '$lib/server/github/traffic';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, isDataRequest }) => {
	// Errors travel as data so their message survives a streamed response
	const result = settle('user-repos', getUserOverview(params.user));
	return inlineReady(
		{
			user: params.user,
			canSeeTraffic: canSeeTraffic(params.user, locals.user?.login),
			result
		},
		isDataRequest
	);
};
