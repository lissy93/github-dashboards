import { getUserOverview, isUserOverviewCached } from '$lib/server/github/user';
import { logError, toDisplayError } from '$lib/errors';
import type { OverviewResult } from '$lib/views/overview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// Errors travel as data so their message survives a streamed response
	const result: Promise<OverviewResult> = getUserOverview(params.user)
		.then((data) => ({ ok: true as const, data }))
		.catch((caught) => {
			logError('user-repos', caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});

	// Render cached lists server-side for SEO, stream only a slow cold miss
	const cachedAlready = await isUserOverviewCached(params.user);
	return {
		user: params.user,
		result: cachedAlready ? await result : result
	};
};
