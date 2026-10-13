import { getRepoSecurity } from '$lib/server/github/security';
import { getRepoContributors } from '$lib/server/github/contributors';
import { canSeeTraffic, getRepoTrafficSummary } from '$lib/server/github/traffic';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Panel summaries for the Info landing page, each source streams so a slow one never blocks the rest
export const load: PageServerLoad = async ({ params, locals, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const { user, repo } = params;

	const security = settle('repo-security', getRepoSecurity(user, repo));
	const contributors = settle('repo-contributors', getRepoContributors(user, repo));
	const canTraffic = canSeeTraffic(user, locals.user?.login);
	const traffic = canTraffic ? settle('repo-traffic', getRepoTrafficSummary(user, repo)) : null;

	return inlineReady({ security, contributors, traffic }, isDataRequest);
};
