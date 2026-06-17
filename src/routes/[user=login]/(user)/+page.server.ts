import { getUserOverview, isUserOverviewCached } from '$lib/server/github/user';
import { canSeeTraffic } from '$lib/server/github/traffic';
import { logError, toDisplayError } from '$lib/errors';
import type { UserOverview } from '$lib/types';
import type { PageServerLoad } from './$types';

export type OverviewResult =
	| { ok: true; data: UserOverview }
	| { ok: false; error: { title: string; message: string } };

export const load: PageServerLoad = async ({ params }) => {
	// Errors travel as data so their message survives a streamed response
	const result: Promise<OverviewResult> = getUserOverview(params.user)
		.then((data) => ({ ok: true as const, data }))
		.catch((caught) => {
			logError('user-overview', caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});

	// Render cached overviews server-side for SEO, stream only a slow cold miss
	const cachedAlready = await isUserOverviewCached(params.user);
	return {
		user: params.user,
		canSeeTraffic: canSeeTraffic(params.user),
		result: cachedAlready ? await result : result
	};
};
