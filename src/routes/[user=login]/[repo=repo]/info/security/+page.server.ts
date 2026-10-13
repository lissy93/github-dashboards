import { getRepoSecurity } from '$lib/server/github/security';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const security = settle('repo-security', getRepoSecurity(params.user, params.repo));
	return inlineReady({ security }, isDataRequest);
};
