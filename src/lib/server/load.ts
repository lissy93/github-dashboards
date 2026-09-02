import { logError, toDisplayError, type DisplayError } from '$lib/utils/errors';
import type { LoadResult } from '$lib/types';

// Panels stop waiting here, the fetch runs on into the cache for the retry to pick up
const SETTLE_TIMEOUT_MS = 30000;

const stillLoading: DisplayError = {
	title: 'still loading',
	message: 'Taking longer than usual, still fetching in the background. Check back shortly',
	code: 'pending',
	pending: true
};

// Wrap a fetch as a LoadResult, so one duff dataset doesn't blank the others.
// A slow task settles as a soft pending result at the timeout instead of holding
// its panel on a skeleton forever
export function settle<T>(
	scope: string,
	task: Promise<T>,
	timeoutMs = SETTLE_TIMEOUT_MS
): Promise<LoadResult<T>> {
	const settled = task
		.then((data) => ({ ok: true as const, data }))
		.catch((caught) => {
			logError(scope, caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<LoadResult<T>>((resolve) => {
		timer = setTimeout(() => resolve({ ok: false, error: stillLoading }), timeoutMs);
	});
	return Promise.race([settled, timeout]).finally(() => clearTimeout(timer));
}
