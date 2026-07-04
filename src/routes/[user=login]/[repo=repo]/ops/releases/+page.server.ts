import { getRepoReleases, isRepoReleasesCached } from '$lib/server/github/releases';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const { user, repo } = params;
	const releases = settle('repo-releases', getRepoReleases(user, repo));
	const ready = await isRepoReleasesCached(user, repo);

	return { releases: ready ? await releases : releases };
};
