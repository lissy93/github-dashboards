import { syncActivity, getActivityPage, isSynced } from '$lib/server/github/activity';
import { settle } from '$lib/server/load';
import { logError } from '$lib/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
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

	// Render inline once seeded for SEO, stream only the cold first build
	const ready = await isSynced(params.user);
	return { user: params.user, isOrg: false as const, result: ready ? await result : result };
};
