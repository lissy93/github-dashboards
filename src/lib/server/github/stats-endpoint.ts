import { restResponse } from '$lib/server/github/client';
import { AppError } from '$lib/utils/errors';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('stats-endpoint');

// GitHub computes the /stats/* endpoints on demand, returning 202 while it builds
// the cache. That warm-up can run for minutes, far longer than a request can wait,
// so poll only briefly in the foreground then hand off to a background warm
const RETRIES = 3;
const RETRY_MS = 1000;
// Background warm: keep nudging GitHub after the request returns, so the cache fills
// itself and a later visit shows the data without the user retrying by hand
const WARM_ATTEMPTS = 12;
const WARM_INTERVAL_MS = 20000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch a 202-async repo stats endpoint. Returns the rows, [] for an empty repo, or
// null while GitHub is still computing so the caller can fall back to a warm
export async function fetchStatsEndpoint<T>(path: string, label: string): Promise<T[] | null> {
	for (let attempt = 0; attempt < RETRIES; attempt++) {
		const res = await restResponse(path);
		if (!res || res.status === 204) return [];
		if (res.status === 202) {
			log.info(`${label} warming, retrying`);
			await delay(RETRY_MS);
			continue;
		}
		const body = await res.json();
		return Array.isArray(body) ? (body as T[]) : [];
	}
	return null;
}

// One background warm per cache key at a time, so repeated visits don't stack loops
const warming = new Set<string>();

// Keep re-running a stats source in the background until GitHub has the data and the
// source caches it. Detached on purpose, failures just mean another attempt
function warmInBackground(key: string, run: () => Promise<unknown>): void {
	if (warming.has(key)) return;
	warming.add(key);
	void (async () => {
		for (let attempt = 0; attempt < WARM_ATTEMPTS; attempt++) {
			await delay(WARM_INTERVAL_MS);
			try {
				await run();
				break;
			} catch {
				// still computing, keep trying until GitHub catches up
			}
		}
		warming.delete(key);
	})();
}

// Note a still-computing endpoint: start a background warm keyed by the source's cache
// key and raise a soft pending error, distinct from a real failure so the UI can show
// a gentle "computing" notice and the strip can leave the metric blank
export function statsPending(key: string, run: () => Promise<unknown>, label: string): never {
	warmInBackground(key, run);
	throw new AppError('pending', `GitHub is still computing the ${label}, it lands shortly`, {
		expose: true
	});
}
