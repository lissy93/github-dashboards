import { getAuthoredContributions } from '$lib/server/github/authored-contributions';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, isDataRequest }) => {
	// Errors travel as data so a streamed cold crawl still renders its message
	const result = settle('user-contributions', getAuthoredContributions(params.user));
	return inlineReady({ user: params.user, result }, isDataRequest);
};
