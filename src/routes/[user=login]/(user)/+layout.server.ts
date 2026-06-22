import { getUserOverview } from '$lib/server/github/user';
import type { LayoutServerLoad } from './$types';

// isOrg drives which nav tabs show, viewerLogin gates the owner-only tabs
export const load: LayoutServerLoad = async ({ params, locals }) => {
	const viewerLogin = locals.user?.login ?? null;
	try {
		const { profile } = await getUserOverview(params.user);
		return { user: params.user, isOrg: profile.isOrg, viewerLogin };
	} catch {
		return { user: params.user, isOrg: false, viewerLogin };
	}
};
