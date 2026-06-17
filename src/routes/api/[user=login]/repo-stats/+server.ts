import { json } from '@sveltejs/kit';
import { getOwnedRepoStats, type RepoStatsMap } from '$lib/server/github/repo-stats';
import { logError } from '$lib/errors';
import type { RequestHandler } from './$types';

// Heavier per-repo counts for the owned repos, loaded lazily after the list renders
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=300' });
	try {
		return json({ repos: await getOwnedRepoStats(params.user) });
	} catch (caught) {
		logError('repo-stats-endpoint', caught);
		return json({ repos: {} as RepoStatsMap });
	}
};
