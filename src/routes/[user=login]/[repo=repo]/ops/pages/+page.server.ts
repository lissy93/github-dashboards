import { getRepoPages } from '$lib/server/github/pages';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const pages = settle('repo-pages', getRepoPages(params.user, params.repo));
	return inlineReady({ pages }, isDataRequest);
};
