import { syncRepoActivity, getActivityPage } from '$lib/server/github/activity';
import { COMMUNITY_EXCLUDE } from '$lib/config/activity';
import { inlineReady, settle } from '$lib/server/load';
import { logError } from '$lib/utils/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const repo = `${params.user}/${params.repo}`;
	// Refresh repo-wide events best-effort, then serve the first page from all contributors.
	// Deep history is backfilled lazily by the API once the user starts scrolling
	const result = settle(
		'repo-activity',
		syncRepoActivity(params.user, params.repo)
			.catch((caught) => logError('repo-activity-sync', caught))
			.then(() => getActivityPage(null, { repo, exclude: COMMUNITY_EXCLUDE }))
	);
	return inlineReady({ result }, isDataRequest);
};
