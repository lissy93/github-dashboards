import { createLogger } from '$lib/logger';

const log = createLogger('owned-maps');

// Share one request per endpoint so panels mounting together never double-fetch
const inflight = new Map<string, Promise<unknown>>();

// Fetch a lazy user endpoint, returning null on any failure
export function loadJson<T>(user: string, endpoint: string): Promise<T | null> {
	const key = `${user}/${endpoint}`;
	const running = inflight.get(key);
	if (running) return running as Promise<T | null>;
	const promise = (async () => {
		try {
			const response = await fetch(`/api/${key}`);
			return (await response.json()) as T;
		} catch (error) {
			log.warn(`failed to load ${endpoint}`, error);
			return null;
		}
	})().finally(() => inflight.delete(key));
	inflight.set(key, promise);
	return promise;
}

// Fetch a lazy endpoint that wraps its payload in a repos map
export async function loadOwnedMap<T>(user: string, endpoint: string): Promise<T | null> {
	const body = await loadJson<{ repos?: T }>(user, endpoint);
	return body?.repos ?? null;
}
