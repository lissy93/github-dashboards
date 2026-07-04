import { isOrgAccount } from '$lib/server/github/user';
import { logError } from '$lib/utils/errors';
import type { LayoutServerLoad } from './$types';

// isOrg drives which nav tabs show, viewerLogin gates the owner-only tabs
export const load: LayoutServerLoad = async ({ params, locals }) => {
	const viewerLogin = locals.user?.login ?? null;
	try {
		return { user: params.user, isOrg: await isOrgAccount(params.user), viewerLogin };
	} catch (error) {
		logError('user-layout', error);
		return { user: params.user, isOrg: false, viewerLogin };
	}
};
