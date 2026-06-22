import { json } from '@sveltejs/kit';
import { getRepo } from '$lib/server/github/repo';
import { getScorecard } from '$lib/server/scorecard';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

const UNAVAILABLE = {
	available: false,
	score: null,
	generatedAt: null,
	scorecardVersion: null,
	checks: []
};

// OpenSSF scorecard for a public repo. Private repos hold no public score, so we
// skip the external call entirely rather than leak the name off-site
export const GET: RequestHandler = async ({ params }) => {
	try {
		const repo = await getRepo(params.user, params.repo);
		if (!repo || repo.isPrivate)
			return json(UNAVAILABLE, { headers: { 'cache-control': 'public, max-age=300' } });
		return json(await getScorecard(params.user, params.repo), {
			headers: { 'cache-control': 'public, max-age=300' }
		});
	} catch (caught) {
		return apiError('repo-scorecard-endpoint', caught);
	}
};
