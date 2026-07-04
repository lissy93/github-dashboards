import { getRepoContributors, isRepoContributorsCached } from '$lib/server/github/contributors';
import { getRepoPeople, isRepoPeopleCached } from '$lib/server/github/repo-people';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const people = settle('repo-people', getRepoContributors(params.user, params.repo));
	const audience = settle('repo-audience', getRepoPeople(params.user, params.repo));
	const [peopleReady, audienceReady] = await Promise.all([
		isRepoContributorsCached(params.user, params.repo),
		isRepoPeopleCached(params.user, params.repo)
	]);
	return {
		people: peopleReady ? await people : people,
		audience: audienceReady ? await audience : audience
	};
};
