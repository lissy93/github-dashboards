import { getRepoPages, isRepoPagesCached } from '$lib/server/github/pages';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { user, repo } = params;
	const pages = settle('repo-pages', getRepoPages(user, repo));
	const ready = await isRepoPagesCached(user, repo);

	return { pages: ready ? await pages : pages };
};
