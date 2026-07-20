import { AsyncLocalStorage } from 'node:async_hooks';
import { eq, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cacheEntry } from '$lib/server/db/schema';
import { config } from '$lib/server/env';
import { createLogger } from '$lib/utils/logger';
import { logError, toAppError, isConnectionError } from '$lib/utils/errors';

const log = createLogger('cache');

// Dedupes concurrent fetches for the same key so we never fire duplicate work
const inflight = new Map<string, Promise<unknown>>();

// Request-scoped flag the freshen-on-land endpoints set, so a stale entry waits for its
// refresh instead of serving stale. Fresh entries and cold misses are unaffected
const freshStore = new AsyncLocalStorage<boolean>();

// Run a block that revalidates stale cache entries inline rather than in the background
export function withForceFresh<T>(run: () => T): T {
	return freshStore.run(true, run);
}

function forceFreshRequested(): boolean {
	return freshStore.getStore() === true;
}

const PURGE_EVERY_MS = 24 * 3600 * 1000;
const PURGE_AFTER_DAYS = 14;
let lastPurge = 0;

// Sweep out entries that sat expired for weeks, so junk rows never pile up
function purgeExpired(): void {
	if (Date.now() - lastPurge < PURGE_EVERY_MS) return;
	lastPurge = Date.now();
	const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 86400 * 1000);
	void db
		.delete(cacheEntry)
		.where(lt(sql`${cacheEntry.fetchedAt} + ${cacheEntry.ttl} * interval '1 second'`, cutoff))
		.then(() => log.debug('purged long-expired cache rows'))
		.catch((error) => log.warn('cache purge failed', { code: toAppError(error).code }));
}

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
	purgeExpired();
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
		// A revalidation request waits for the fresh value, falling back to stale on failure
		if (forceFreshRequested()) {
			try {
				return await refresh(key, fetcher, ttl);
			} catch (error) {
				log.warn(`forced refresh failed for ${key}`, { code: toAppError(error).code });
				return existing.value as T;
			}
		}
		refresh(key, fetcher, ttl).catch((error) =>
			log.warn(`background refresh failed for ${key}`, { code: toAppError(error).code })
		);
		return existing.value as T;
	}

	return refresh(key, fetcher, ttl);
}

// Sync jobs in flight, keyed by cache key so concurrent visitors share one run
const checkpointSyncs = new Map<string, Promise<unknown>>();

// Serve the stored checkpoint: a cold miss blocks on one shared sync, stale data
// is served instantly while a background sync reseeds it from the current value
export async function checkpointed<T>(
	scope: string,
	key: string,
	ttl: number,
	sync: (current?: T) => Promise<T>
): Promise<T> {
	const run = (current?: T): Promise<T> => {
		const running = checkpointSyncs.get(key);
		if (running) return running as Promise<T>;
		const task = (async () => {
			const state = await sync(current);
			await writeCached(key, state, ttl);
			return state;
		})().finally(() => checkpointSyncs.delete(key));
		checkpointSyncs.set(key, task);
		return task;
	};

	let stored: Awaited<ReturnType<typeof readCached<T>>> = null;
	try {
		stored = await readCached<T>(key);
	} catch (caught) {
		logError(scope, caught);
	}
	if (!stored) return run();
	if (Date.now() - stored.fetchedAt.getTime() >= ttl * 1000) {
		// A revalidation request waits for one more sync round, falling back to stored on failure
		if (forceFreshRequested()) {
			try {
				return await run(stored.value);
			} catch (caught) {
				logError(scope, caught);
				return stored.value;
			}
		}
		void run(stored.value).catch((caught) => logError(scope, caught));
	}
	return stored.value;
}

// One more sync round on demand, for the progressive advance endpoints. Joins any
// round already in flight, so concurrent viewers never trigger duplicate crawls
export async function advanceCheckpointed<T>(
	key: string,
	ttl: number,
	sync: (current?: T) => Promise<T>
): Promise<T> {
	const running = checkpointSyncs.get(key);
	if (running) return running as Promise<T>;
	const stored = await readCached<T>(key).catch(() => null);
	const task = (async () => {
		const state = await sync(stored?.value);
		await writeCached(key, state, ttl);
		return state;
	})().finally(() => checkpointSyncs.delete(key));
	checkpointSyncs.set(key, task);
	return task;
}
