import { json } from '@sveltejs/kit';
import { logError, toDisplayError } from '$lib/errors';

// Return a real HTTP failure so clients never mistake an outage for empty data
export function apiError(scope: string, caught: unknown) {
	const error = logError(scope, caught);
	return json(toDisplayError(error), {
		status: error.status,
		headers: { 'cache-control': 'private, no-store' }
	});
}
