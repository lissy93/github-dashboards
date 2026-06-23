import { error } from '@sveltejs/kit';
import { canViewRepo, getRepo } from '$lib/server/github/repo';
import { getRepoStats } from '$lib/server/github/repo-stats';
import { canSeeTraffic } from '$lib/server/github/traffic';
import { settle } from '$lib/server/load';
import type { LayoutServerLoad } from './$types';

// Load the repo header once for the whole section, 404 when it is gone or hidden
export const load: LayoutServerLoad = async ({ params, locals }) => {
	const repo = await getRepo(params.user, params.repo);
	if (!repo || !canViewRepo(repo, locals.user?.login))
		error(404, `No repo named ${params.user}/${params.repo}`);

	return {
		user: params.user,
		repo,
		stats: settle('repo-stats', getRepoStats(params.user, params.repo)),
		viewerLogin: locals.user?.login ?? null,
		canSeeTraffic: canSeeTraffic(params.user, locals.user?.login)
	};
};
