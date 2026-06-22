import { json } from '@sveltejs/kit';
import { getRepoContributors } from '$lib/server/github/contributors';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// Ranked contributor leaderboard for a single repo
export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await getRepoContributors(params.user, params.repo), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('repo-people-endpoint', caught);
	}
};
