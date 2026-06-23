import { getRepoReleases, isRepoReleasesCached } from '$lib/server/github/releases';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { user, repo } = params;
	const releases = settle('repo-releases', getRepoReleases(user, repo));
	const ready = await isRepoReleasesCached(user, repo);

	return { releases: ready ? await releases : releases };
};
