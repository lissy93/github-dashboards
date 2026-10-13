import { getRepoContributors } from '$lib/server/github/contributors';
import { getRepoPeople } from '$lib/server/github/repo-people';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const people = settle('repo-people', getRepoContributors(params.user, params.repo));
	const audience = settle('repo-audience', getRepoPeople(params.user, params.repo));
	return inlineReady({ people, audience }, isDataRequest);
};
