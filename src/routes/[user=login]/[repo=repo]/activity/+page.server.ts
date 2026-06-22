import { syncActivity, getActivityPage } from '$lib/server/github/activity';
import { settle } from '$lib/server/load';
import { logError } from '$lib/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const repo = `${params.user}/${params.repo}`;
	// Refresh the owner's recent events best-effort, then serve this repo's first page.
	// Deep history is backfilled lazily by the API once the user starts scrolling
	const result = settle(
		'repo-activity',
		syncActivity(params.user)
			.catch((caught) => logError('repo-activity-sync', caught))
			.then(() => getActivityPage(params.user, { repo }))
	);
	return { result };
};
