import { beginLoading } from '$lib/state/loading.svelte';
import { noteSession } from '$lib/state/session.svelte';
import { createLogger } from '$lib/utils/logger';
import type { DisplayError } from '$lib/utils/errors';
import type { LoadResult } from '$lib/types';

const log = createLogger('api');
const TIMEOUT_MS = 20000;
// A cold cache can time out the first load while the server keeps warming it in the
// background, so retry transient failures a couple of times with a growing gap between
const RETRY_DELAYS_MS = [1500, 5000];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const noop = () => {};

// Worth a quick retry: an upstream gateway blip or a client-side timeout (tagged
// unavailable below). Permanent failures (auth, not found, rate limited) the user sees
export const isTransient = (error: DisplayError) =>
	error.code === 'upstream' || error.code === 'unavailable';

// Share one request per endpoint so panels mounting together never double-fetch
const inflight = new Map<string, Promise<LoadResult<unknown>>>();

// Fetch one of our api routes, throwing the parsed apiError body on failure so
// panels can render the server's message through toDisplayError. Background pollers
// pass background=true so long deepen loops don't keep the top progress bar lit
export async function fetchApi<T>(
	url: string,
	timeoutMs = TIMEOUT_MS,
	background = false
): Promise<T> {
	const end = background ? noop : beginLoading();
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
		const body = await response.json();
		if (!response.ok) {
			noteSession(body);
			throw body;
		}
		return body as T;
	} finally {
		end();
	}
}

// One fetch of a lazy endpoint, mapping the response to a loading result
async function attempt<T>(key: string, endpoint: string): Promise<LoadResult<T>> {
	try {
		const response = await fetch(`/api/${key}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
		const body = (await response.json()) as T | DisplayError;
		if (response.ok) return { ok: true as const, data: body as T };
		noteSession(body);
		return { ok: false as const, error: body as DisplayError };
	} catch (error) {
		log.warn(`failed to load ${endpoint}`, error);
		return {
			ok: false as const,
			error: { title: 'network error', message: 'Could not load this data', code: 'unavailable' }
		};
	}
}

// Fetch a lazy user endpoint with one consistent loading result, timeout and retry
export function loadJson<T>(user: string, endpoint: string): Promise<LoadResult<T>> {
	const key = `${user}/${endpoint}`;
	const running = inflight.get(key);
	if (running) return running as Promise<LoadResult<T>>;
	const end = beginLoading();
	const promise = (async () => {
		let result = await attempt<T>(key, endpoint);
		for (const delay of RETRY_DELAYS_MS) {
			if (result.ok || !isTransient(result.error)) break;
			await wait(delay);
			result = await attempt<T>(key, endpoint);
		}
		return result;
	})().finally(() => {
		inflight.delete(key);
		end();
	});
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
