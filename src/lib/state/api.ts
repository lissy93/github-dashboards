import { createLogger } from '$lib/utils/logger';
import type { DisplayError } from '$lib/utils/errors';
import type { LoadResult } from '$lib/types';

const log = createLogger('api');
const TIMEOUT_MS = 20000;

// Share one request per endpoint so panels mounting together never double-fetch
const inflight = new Map<string, Promise<LoadResult<unknown>>>();

// Fetch one of our api routes, throwing the parsed apiError body on failure so
// panels can render the server's message through toDisplayError
export async function fetchApi<T>(url: string, timeoutMs = TIMEOUT_MS): Promise<T> {
	const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
	const body = await response.json();
	if (!response.ok) throw body;
	return body as T;
}

// Fetch a lazy user endpoint with one consistent loading result and timeout
export function loadJson<T>(user: string, endpoint: string): Promise<LoadResult<T>> {
	const key = `${user}/${endpoint}`;
	const running = inflight.get(key);
	if (running) return running as Promise<LoadResult<T>>;
	const promise = (async () => {
		try {
			const response = await fetch(`/api/${key}`, {
				signal: AbortSignal.timeout(TIMEOUT_MS)
			});
			const body = (await response.json()) as T | DisplayError;
			if (response.ok) return { ok: true as const, data: body as T };
			return { ok: false as const, error: body as DisplayError };
		} catch (error) {
			log.warn(`failed to load ${endpoint}`, error);
			return {
				ok: false as const,
				error: { title: 'network error', message: 'Could not load this data' }
			};
		}
	})().finally(() => inflight.delete(key));
	inflight.set(key, promise as Promise<LoadResult<unknown>>);
	return promise;
}

// Fetch a lazy endpoint that wraps its payload in a repos map
export async function loadOwnedMap<T>(user: string, endpoint: string): Promise<LoadResult<T>> {
	const result = await loadJson<{ repos: T }>(user, endpoint);
	return result.ok ? { ok: true, data: result.data.repos } : result;
}

type MaybeResult<T> = Promise<LoadResult<T>> | LoadResult<T>;

// Await several results as one, first failure wins so the panel shows its message
export async function combineResults<T extends unknown[]>(
	...results: { [K in keyof T]: MaybeResult<T[K]> }
): Promise<LoadResult<T>> {
	const settled = await Promise.all(results);
	const failed = settled.find((entry) => !entry.ok);
	if (failed && !failed.ok) return failed;
	return { ok: true, data: settled.map((entry) => (entry as { data: unknown }).data) as T };
}

// Unwrap a settled result, null when it failed
export function ok<T>(result: LoadResult<T>): T | null {
	return result.ok ? result.data : null;
}
