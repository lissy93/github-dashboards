import { getRepoSecurity, isRepoSecurityCached } from '$lib/server/github/security';
import { getRepoContributors, isRepoContributorsCached } from '$lib/server/github/contributors';
import { canSeeTraffic, getRepoTrafficSummary } from '$lib/server/github/traffic';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Panel summaries for the Info landing page. Each source streams so a slow one never
// blocks the others, and cached hits render inline
export const load: PageServerLoad = async ({ params, locals, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const { user, repo } = params;

	const security = settle('repo-security', getRepoSecurity(user, repo));
	const contributors = settle('repo-contributors', getRepoContributors(user, repo));
	const canTraffic = canSeeTraffic(user, locals.user?.login);
	const traffic = canTraffic ? settle('repo-traffic', getRepoTrafficSummary(user, repo)) : null;

	const [secReady, contribReady] = await Promise.all([
		isRepoSecurityCached(user, repo),
		isRepoContributorsCached(user, repo)
	]);

	return {
		security: secReady ? await security : security,
		contributors: contribReady ? await contributors : contributors,
		traffic
	};
};
