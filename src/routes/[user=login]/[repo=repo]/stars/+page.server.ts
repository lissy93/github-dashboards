import { getRepoStarHistory } from '$lib/server/github/star-history';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => ({
	stars: settle('repo-stars', getRepoStarHistory(params.user, params.repo))
});
