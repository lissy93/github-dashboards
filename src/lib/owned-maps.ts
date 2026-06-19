import { createLogger } from '$lib/logger';
import type { DisplayError } from '$lib/errors';

const log = createLogger('owned-maps');
const TIMEOUT_MS = 20000;

// Share one request per endpoint so panels mounting together never double-fetch
const inflight = new Map<string, Promise<LoadResult<unknown>>>();

export type LoadResult<T> = { ok: true; data: T } | { ok: false; error: DisplayError };

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
