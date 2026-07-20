import { json, type RequestHandler } from '@sveltejs/kit';
import { logError, toDisplayError } from '$lib/utils/errors';
import { requireRepo } from '$lib/server/github/repo';
import { withForceFresh } from '$lib/server/cache';

// Return a real HTTP failure so clients never mistake an outage for empty data
export function apiError(scope: string, caught: unknown) {
	const error = logError(scope, caught);
	return json(toDisplayError(error), {
		status: error.status,
		headers: { 'cache-control': 'private, no-store' }
	});
}

// A GET handler for one repo dataset, gated by repo visibility. ?fresh=1 from a signed-in
// viewer revalidates inline so the panel freshens on land and the shared cache warms
export function repoFreshEndpoint<T>(
	scope: string,
	load: (owner: string, name: string) => Promise<T>
): RequestHandler {
	return async ({ params, locals, url, setHeaders }) => {
		const { user, repo } = params as { user: string; repo: string };
		try {
			await requireRepo(user, repo, locals.user?.login);
			const fresh = url.searchParams.has('fresh') && !!locals.user;
			setHeaders({ 'cache-control': 'private, no-store' });
			const run = () => load(user, repo);
			return json(fresh ? await withForceFresh(run) : await run());
		} catch (caught) {
			return apiError(scope, caught);
		}
	};
}

// The same freshen-on-land handler for a user or org dataset, keyed by login
export function userFreshEndpoint<T>(
	scope: string,
	load: (login: string) => Promise<T>
): RequestHandler {
	return async ({ params, locals, url, setHeaders }) => {
		const { user } = params as { user: string };
		try {
			const fresh = url.searchParams.has('fresh') && !!locals.user;
			setHeaders({ 'cache-control': 'private, no-store' });
			const run = () => load(user);
			return json(fresh ? await withForceFresh(run) : await run());
		} catch (caught) {
			return apiError(scope, caught);
		}
	};
}
