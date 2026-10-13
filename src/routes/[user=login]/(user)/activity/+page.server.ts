import { syncActivity, getActivityPage } from '$lib/server/github/activity';
import { inlineReady, settle } from '$lib/server/load';
import { logError } from '$lib/utils/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// Orgs have no personal events feed, so skip the work and flag it for the page
	const { isOrg } = await parent();
	if (isOrg) return { user: params.user, isOrg: true as const };

	// Refresh recent events best-effort, then serve the first page from the store.
	// Deep history is backfilled lazily by the API once the user starts scrolling
	const result = settle(
		'activity',
		syncActivity(params.user)
			.catch((caught) => logError('activity-sync', caught))
			.then(() => getActivityPage(params.user))
	);
	return inlineReady({ user: params.user, isOrg: false as const, result }, isDataRequest);
};
