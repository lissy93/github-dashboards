import { getUserOverview } from '$lib/server/github/user';
import type { LayoutServerLoad } from './$types';

// isOrg drives which nav tabs show, becos varies between orgs and users
export const load: LayoutServerLoad = async ({ params }) => {
	try {
		const { profile } = await getUserOverview(params.user);
		return { user: params.user, isOrg: profile.isOrg };
	} catch {
		return { user: params.user, isOrg: false };
	}
};
