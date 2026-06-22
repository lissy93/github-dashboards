import { getScorecard, isScorecardCached, type RepoScorecard } from '$lib/server/scorecard';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

const UNAVAILABLE: RepoScorecard = {
	available: false,
	score: null,
	generatedAt: null,
	scorecardVersion: null,
	checks: []
};

export const load: PageServerLoad = async ({ params, parent }) => {
	const { repo } = await parent();
	// The OpenSSF API holds nothing for private repos, so do not even ask
	if (repo.isPrivate) return { scorecard: { ok: true as const, data: UNAVAILABLE } };

	const scorecard = settle('repo-scorecard', getScorecard(params.user, params.repo));
	const ready = await isScorecardCached(params.user, params.repo);
	return { scorecard: ready ? await scorecard : scorecard };
};
