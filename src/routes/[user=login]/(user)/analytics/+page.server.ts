import { canSeeTraffic } from '$lib/server/github/traffic';
import type { PageServerLoad } from './$types';

// Analytics is owner-only, the page renders a notice when the viewer can't see it
export const load: PageServerLoad = ({ params, locals }) => ({
	user: params.user,
	allowed: canSeeTraffic(params.user, locals.user?.login),
	loggedIn: !!locals.user
});
