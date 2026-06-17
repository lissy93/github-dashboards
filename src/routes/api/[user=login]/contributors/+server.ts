import { json } from '@sveltejs/kit';
import { getOwnedContributors, type ContributorMap } from '$lib/server/github/contributors';
import { logError } from '$lib/errors';
import type { RequestHandler } from './$types';

// Per-repo contributor counts for the owned repos, filled in lazily after render
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=300' });
	try {
		return json({ repos: await getOwnedContributors(params.user) });
	} catch (caught) {
		logError('contributors-endpoint', caught);
		return json({ repos: {} as ContributorMap });
	}
};
