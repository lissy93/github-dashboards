import { createLogger } from '$lib/logger';

const log = createLogger('owned-maps');

// Fetch a lazy user endpoint, returning null on any failure
export async function loadJson<T>(user: string, endpoint: string): Promise<T | null> {
	try {
		const response = await fetch(`/api/${user}/${endpoint}`);
		return (await response.json()) as T;
	} catch (error) {
		log.warn(`failed to load ${endpoint}`, error);
		return null;
	}
}

// Fetch a lazy endpoint that wraps its payload in a repos map
export async function loadOwnedMap<T>(user: string, endpoint: string): Promise<T | null> {
	const body = await loadJson<{ repos?: T }>(user, endpoint);
	return body?.repos ?? null;
}
