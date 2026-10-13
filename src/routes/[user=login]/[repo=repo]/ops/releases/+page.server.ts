import { getRepoReleases } from '$lib/server/github/releases';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const releases = settle('repo-releases', getRepoReleases(params.user, params.repo));
	return inlineReady({ releases }, isDataRequest);
};
