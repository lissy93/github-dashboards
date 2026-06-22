import { isStorageHealthy } from '$lib/server/cache';
import { oauthEnabled } from '$lib/server/auth/oauth';
import type { LayoutServerLoad } from './$types';

// Flag storage outages and surface the signed-in user to the whole app
export const load: LayoutServerLoad = ({ locals }) => ({
	storageDegraded: !isStorageHealthy(),
	user: locals.user,
	loginEnabled: oauthEnabled()
});
