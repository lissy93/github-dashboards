import { json } from '@sveltejs/kit';
import { canSeeTraffic } from '$lib/server/github/traffic';
import { getRepoAnalytics } from '$lib/server/github/analytics';
import { apiError } from '$lib/server/response';
import { AppError } from '$lib/utils/errors';
import type { RequestHandler } from './$types';

// Single-repo traffic analytics, owner-only since traffic is private
export const GET: RequestHandler = async ({ params, locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	try {
		if (!canSeeTraffic(params.user, locals.user?.login))
			throw new AppError('forbidden', 'Traffic is only available to the account owner');
		return json(await getRepoAnalytics(params.user, params.repo));
	} catch (caught) {
		return apiError('repo-analytics-endpoint', caught);
	}
};
