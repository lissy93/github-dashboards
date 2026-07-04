import { logError, toDisplayError } from '$lib/utils/errors';
import type { LoadResult } from '$lib/types';

// Wrap a fetch as a LoadResult, so one duff dataset doesn't blank the others
export function settle<T>(scope: string, task: Promise<T>): Promise<LoadResult<T>> {
	return task
		.then((data) => ({ ok: true as const, data }))
		.catch((caught) => {
			logError(scope, caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});
}
