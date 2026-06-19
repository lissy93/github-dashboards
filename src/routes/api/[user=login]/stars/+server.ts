import { json } from '@sveltejs/kit';
import { getUserOverview } from '$lib/server/github/user';
import { getStarBaselines } from '$lib/server/github/stars';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Window baselines per owned repo so the client can derive star deltas
export const GET: RequestHandler = async ({ params }) => {
	try {
		const { ownedRepos } = await getUserOverview(params.user);
		const repos = await getStarBaselines(ownedRepos.map((repo) => repo.nameWithOwner));
		return json({ repos }, { headers: { 'cache-control': 'public, max-age=300' } });
	} catch (caught) {
		return apiError('stars-endpoint', caught);
	}
};
