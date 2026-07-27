import { getAuthoredContributions } from '$lib/server/github/authored-contributions';
import { isAuthoredTimelineCached } from '$lib/server/github/authored-timeline';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// Errors travel as data so a streamed cold crawl still renders its message
	const result = settle('user-contributions', getAuthoredContributions(params.user));

	// Render the warm crawl server-side for SEO, stream only a slow cold miss
	const ready = await isAuthoredTimelineCached(params.user);
	return { user: params.user, result: ready ? await result : result };
};
