import { syncRepoActivity, getActivityPage } from '$lib/server/github/activity';
import { COMMUNITY_EXCLUDE } from '$lib/components/activity/activity-config';
import { settle } from '$lib/server/load';
import { logError } from '$lib/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const repo = `${params.user}/${params.repo}`;
	// Refresh repo-wide events best-effort, then serve the first page from all contributors.
	// Deep history is backfilled lazily by the API once the user starts scrolling
	const result = settle(
		'repo-activity',
		syncRepoActivity(params.user, params.repo)
			.catch((caught) => logError('repo-activity-sync', caught))
			.then(() => getActivityPage(null, { repo, exclude: COMMUNITY_EXCLUDE }))
	);
	return { result };
};
