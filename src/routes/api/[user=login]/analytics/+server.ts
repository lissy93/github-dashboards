import { json } from '@sveltejs/kit';
import { canSeeTraffic } from '$lib/server/github/traffic';
import { getUserAnalytics } from '$lib/server/github/analytics';
import { apiError } from '$lib/server/response';
import { AppError } from '$lib/errors';
import type { RequestHandler } from './$types';

// Combined repo traffic analytics, owner-only since traffic is private
export const GET: RequestHandler = async ({ params, locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	try {
		if (!canSeeTraffic(params.user, locals.user?.login))
			throw new AppError('forbidden', 'Analytics is only available to the account owner');
		return json(await getUserAnalytics(params.user));
	} catch (caught) {
		return apiError('analytics-endpoint', caught);
	}
};
