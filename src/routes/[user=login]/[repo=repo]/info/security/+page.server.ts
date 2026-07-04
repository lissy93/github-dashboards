import { getRepoSecurity, isRepoSecurityCached } from '$lib/server/github/security';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const security = settle('repo-security', getRepoSecurity(params.user, params.repo));
	// Render inline when already cached, stream only a cold miss
	const ready = await isRepoSecurityCached(params.user, params.repo);
	return { security: ready ? await security : security };
};
