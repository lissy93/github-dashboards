import { getRepoPages, isRepoPagesCached } from '$lib/server/github/pages';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const { user, repo } = params;
	const pages = settle('repo-pages', getRepoPages(user, repo));
	const ready = await isRepoPagesCached(user, repo);

	return { pages: ready ? await pages : pages };
};
