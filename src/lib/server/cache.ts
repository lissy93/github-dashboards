import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cacheEntry } from '$lib/server/db/schema';
import { config } from '$lib/server/env';
import { createLogger } from '$lib/logger';
import { toAppError, isConnectionError } from '$lib/errors';

const log = createLogger('cache');

// Dedupes concurrent fetches for the same key so we never fire duplicate work
const inflight = new Map<string, Promise<unknown>>();

// Latest known storage health, so the UI can warn when we are serving uncached
let storageReachable = true;
export const isStorageHealthy = () => storageReachable;

function isFresh(fetchedAt: Date, ttl: number): boolean {
	return Date.now() - fetchedAt.getTime() < ttl * 1000;
}

// Whether a key has any stored value, fresh or stale (served instantly either way).
// This is only a hint for SSR-vs-stream gating, so a DB failure falls back to
// "not cached" (stream it) rather than crashing the page that asked.
export async function isCached(key: string): Promise<boolean> {
	try {
		const [existing] = await db
			.select({ key: cacheEntry.key })
			.from(cacheEntry)
			.where(eq(cacheEntry.key, key))
			.limit(1);
		storageReachable = true;
		return Boolean(existing);
	} catch (error) {
		if (isConnectionError(error)) storageReachable = false;
		log.warn(`cache probe failed for ${key}`, { code: toAppError(error).code });
		return false;
	}
}

// Read any stored value and its age without triggering a refresh
export async function readCached<T>(
	key: string
): Promise<{ value: T; fetchedAt: Date; ttl: number } | null> {
	try {
		const [existing] = await db.select().from(cacheEntry).where(eq(cacheEntry.key, key)).limit(1);
		storageReachable = true;
		return existing
			? { value: existing.value as T, fetchedAt: existing.fetchedAt, ttl: existing.ttl }
			: null;
	} catch (error) {
		if (isConnectionError(error)) storageReachable = false;
		throw error;
	}
}

// Replace a stored value, used by resumable sync jobs that checkpoint their progress
export async function writeCached<T>(key: string, value: T, ttl: number): Promise<void> {
	try {
		await db
			.insert(cacheEntry)
			.values({ key, value: value as object, ttl })
			.onConflictDoUpdate({
				target: cacheEntry.key,
				set: { value: value as object, ttl, fetchedAt: new Date() }
			});
		storageReachable = true;
	} catch (error) {
		if (!isConnectionError(error)) throw error;
		storageReachable = false;
		log.warn(`storage unavailable, could not checkpoint ${key}`);
	}
}

// Fetch fresh data and store it, sharing one promise across concurrent callers
function refresh<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
	const running = inflight.get(key);
	if (running) return running as Promise<T>;

	const promise = (async () => {
		const value = await fetcher();
		await db
			.insert(cacheEntry)
			.values({ key, value: value as object, ttl })
			.onConflictDoUpdate({
				target: cacheEntry.key,
				set: { value: value as object, ttl, fetchedAt: new Date() }
			});
		return value;
	})().finally(() => inflight.delete(key));

	inflight.set(key, promise);
	return promise;
}

// Get a cached value: serve fresh hits, serve stale instantly while revalidating
// in the background, and block only on a cold miss
export async function cached<T>(
	key: string,
	fetcher: () => Promise<T>,
	ttl: number = config.CACHE_TTL_SECONDS
): Promise<T> {
	let existing: typeof cacheEntry.$inferSelect | undefined;
	try {
		[existing] = await db.select().from(cacheEntry).where(eq(cacheEntry.key, key)).limit(1);
		storageReachable = true;
	} catch (error) {
		if (!isConnectionError(error)) throw error;
		// storage is down, serve straight from the source so the page still works
		storageReachable = false;
		log.warn(`storage unavailable, serving live for ${key}`);
		return fetcher();
	}

	if (existing && isFresh(existing.fetchedAt, ttl)) return existing.value as T;

	if (existing) {
		refresh(key, fetcher, ttl).catch((error) =>
			log.warn(`background refresh failed for ${key}`, { code: toAppError(error).code })
		);
		return existing.value as T;
	}

	return refresh(key, fetcher, ttl);
}
