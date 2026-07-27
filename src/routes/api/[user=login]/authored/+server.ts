import { json } from '@sveltejs/kit';
import {
	advanceAuthoredContributions,
	getAuthoredContributions
} from '$lib/server/github/authored-contributions';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// The user's authored contributions grouped by year, advancing one more batch of older
// history when a signed-in viewer asks so the list fills in and caches for everyone
export const GET: RequestHandler = async ({ params, locals, url, setHeaders }) => {
	try {
		const advance = url.searchParams.has('advance') && !!locals.user;
		setHeaders({ 'cache-control': 'private, no-store' });
		const data = advance
			? await advanceAuthoredContributions(params.user)
			: await getAuthoredContributions(params.user);
		return json(data);
	} catch (caught) {
		return apiError('user-authored-endpoint', caught);
	}
};
