import { ingestActivity, getActivityPage, isActivityReady } from '$lib/server/github/activity';
import { logError, toDisplayError } from '$lib/errors';
import type { ActivityPage } from '$lib/types';
import type { PageServerLoad } from './$types';

export type ActivityResult =
	| { ok: true; page: ActivityPage }
	| { ok: false; error: { title: string; message: string } };

export const load: PageServerLoad = async ({ params, parent }) => {
	// Orgs have no personal events feed, so skip the work and flag it for the page
	const { isOrg } = await parent();
	if (isOrg) return { user: params.user, isOrg: true as const };

	// Refresh from GitHub best-effort, then serve the page from the store
	const result: Promise<ActivityResult> = ingestActivity(params.user)
		.then(() => getActivityPage(params.user))
		.then((page) => ({ ok: true as const, page }))
		.catch((caught) => {
			logError('activity', caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});

	// Render inline once seeded for SEO, stream only the cold first build
	const ready = await isActivityReady(params.user);
	return { user: params.user, isOrg: false as const, result: ready ? await result : result };
};
