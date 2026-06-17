import { json } from '@sveltejs/kit';
import { getUserOverview } from '$lib/server/github/user';
import { getStarBaselines, type StarBaselines } from '$lib/server/github/stars';
import { logError } from '$lib/errors';
import type { RequestHandler } from './$types';

export type StarBaselineMap = Record<string, StarBaselines>;

// Window baselines per owned repo so the client can derive star deltas
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=300' });
	try {
		const { ownedRepos } = await getUserOverview(params.user);
		const repos = await getStarBaselines(ownedRepos.map((repo) => repo.nameWithOwner));
		return json({ repos });
	} catch (caught) {
		logError('stars-endpoint', caught);
		return json({ repos: {} as StarBaselineMap });
	}
};
