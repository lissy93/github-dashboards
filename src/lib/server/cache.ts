import { AsyncLocalStorage } from 'node:async_hooks';
import { gzipSync, gunzipSync } from 'node:zlib';
import { and, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cacheEntry } from '$lib/server/db/schema';
import { config } from '$lib/server/env';
import { createLogger } from '$lib/utils/logger';
import { logError, rootReason, toAppError, isConnectionError } from '$lib/utils/errors';

const log = createLogger('cache');

// Dedupes concurrent fetches for the same key so we never fire duplicate work
const inflight = new Map<string, Promise<unknown>>();

// Freshen-on-land waits on stale entries, an explicit update refetches even fresh ones
export type FreshMode = 'stale' | 'all';
const freshStore = new AsyncLocalStorage<FreshMode>();

// Run a block that revalidates cache entries inline, so a failure reaches the caller
export function withForceFresh<T>(run: () => T, mode: FreshMode = 'stale'): T {
	return freshStore.run(mode, run);
}

const forceFreshRequested = () => freshStore.getStore() !== undefined;
const refetchAll = () => freshStore.getStore() === 'all';

// Values past this size gzip well (file trees, crawl states), smaller ones stay plain
const PACK_MIN_BYTES = 4096;

// Refetchable values whose packed form exceeds this are served but never stored, since
// refetching one bulky entry costs less than letting it dominate storage. Checkpoints,
// which cannot be rebuilt on demand, go through writeCached and are exempt
const MAX_PERSIST_BYTES = 1024 * 1024;

// Gzip a big value into a compact wrapper so bulky entries stop dominating storage
export function packValue(value: unknown): unknown {
	const json = JSON.stringify(value);
	if (json.length < PACK_MIN_BYTES) return value;
	return { __gz: gzipSync(json).toString('base64') };
}

// Expand a packed wrapper back into the original value, plain values pass through
export function unpackValue<T>(value: unknown): T {
	const packed = value as { __gz?: unknown } | null;
	if (packed && typeof packed.__gz === 'string')
		return JSON.parse(gunzipSync(Buffer.from(packed.__gz, 'base64')).toString('utf8')) as T;
	return value as T;
}

const PURGE_EVERY_MS = 24 * 3600 * 1000;
const PURGE_AFTER_DAYS = 14;
// Full file trees are big and one call to refetch, so their stale copies go much sooner
const PURGE_TREES_AFTER_DAYS = 3;
let lastPurge = 0;

// Delete entries that sat expired past their retention, trees on the short fuse.
// The cutoff goes over as an ISO string, drizzle cannot type a Date against a raw fragment
export async function purgeExpiredNow(): Promise<void> {
	const cutoff = (days: number) => new Date(Date.now() - days * 86400 * 1000).toISOString();
	const expiredBefore = (when: string) =>
		sql`${cacheEntry.fetchedAt} + ${cacheEntry.ttl} * interval '1 second' < ${when}::timestamptz`;
	await db
		.delete(cacheEntry)
		.where(
			or(
				expiredBefore(cutoff(PURGE_AFTER_DAYS)),
				and(like(cacheEntry.key, 'repo:tree:%'), expiredBefore(cutoff(PURGE_TREES_AFTER_DAYS)))
			)
		);
}

// Daily background sweep. Serverless can freeze before this lands, the maintenance cron
// is the reliable path there
function purgeExpired(): void {
	if (Date.now() - lastPurge < PURGE_EVERY_MS) return;
	lastPurge = Date.now();
	void purgeExpiredNow()
		.then(() => log.debug('purged long-expired cache rows'))
		.catch((error) => log.warn('cache purge failed', { code: toAppError(error).code }));
}

// Latest known storage health, so the UI can warn when we are serving uncached
let storageReachable = true;
export const isStorageHealthy = () => storageReachable;

export function isFresh(fetchedAt: Date, ttl: number): boolean {
	return Date.now() - fetchedAt.getTime() < ttl * 1000;
}

// Whether a key has any stored value, fresh or stale (served instantly either way).
// This is only a hint, so a DB failure falls back to "not cached" rather than
// crashing the page that asked.
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
			? { value: unpackValue<T>(existing.value), fetchedAt: existing.fetchedAt, ttl: existing.ttl }
			: null;
	} catch (error) {
		if (isConnectionError(error)) storageReachable = false;
		throw error;
	}
}

// Read many keys in one query, unpacking each, returning only those found. A DB failure
// degrades to an empty map so the caller treats every key as a cold miss rather than crash
export async function readCachedMany<T>(keys: string[]): Promise<Map<string, T>> {
	if (!keys.length) return new Map();
	try {
		const rows = await db
			.select({ key: cacheEntry.key, value: cacheEntry.value })
			.from(cacheEntry)
			.where(inArray(cacheEntry.key, keys));
		storageReachable = true;
		return new Map(rows.map((row) => [row.key, unpackValue<T>(row.value)]));
	} catch (error) {
		if (isConnectionError(error)) storageReachable = false;
		log.warn('batch cache read failed', { code: toAppError(error).code });
		return new Map();
	}
}

// Replace a checkpointed value, an unchanged one only bumps fetchedAt to spare the rewrite
export async function writeCached<T>(
	key: string,
	value: T,
	ttl: number,
	previous?: T
): Promise<void> {
	try {
		if (previous !== undefined && JSON.stringify(value) === JSON.stringify(previous)) {
			await db
				.update(cacheEntry)
				.set({ fetchedAt: new Date(), ttl })
				.where(eq(cacheEntry.key, key));
			storageReachable = true;
			return;
		}
		const packed = packValue(value) as object;
		await db
			.insert(cacheEntry)
			.values({ key, value: packed, ttl })
			.onConflictDoUpdate({
				target: cacheEntry.key,
				set: { value: packed, ttl, fetchedAt: new Date() }
			});
		storageReachable = true;
	} catch (error) {
		// Checkpoints are best-effort, callers still hold the state they just built
		if (isConnectionError(error)) storageReachable = false;
		log.warn(`could not checkpoint ${key}`, { reason: rootReason(error) });
	}
}

// Fetch fresh data and store it, sharing one promise across concurrent callers. An
// unchanged payload only bumps fetchedAt, sparing the row a full value rewrite
function refresh<T>(
	key: string,
	fetcher: () => Promise<T>,
	ttl: number,
	previous?: unknown
): Promise<T> {
	const running = inflight.get(key);
	if (running) return running as Promise<T>;

	const promise = (async () => {
		const value = await fetcher();
		const packed = packValue(value) as object;
		const serialized = JSON.stringify(packed);
		try {
			if (serialized.length > MAX_PERSIST_BYTES) {
				log.debug(`value too large to persist for ${key}`, { bytes: serialized.length });
			} else if (previous !== undefined && serialized === JSON.stringify(previous)) {
				await db
					.update(cacheEntry)
					.set({ fetchedAt: new Date(), ttl })
					.where(eq(cacheEntry.key, key));
			} else {
				await db
					.insert(cacheEntry)
					.values({ key, value: packed, ttl })
					.onConflictDoUpdate({
						target: cacheEntry.key,
						set: { value: packed, ttl, fetchedAt: new Date() }
					});
			}
		} catch (error) {
			// The fetch already succeeded, a failed persist must not cost callers the value
			log.warn(`cache write failed for ${key}`, { reason: rootReason(error) });
		}
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

	if (existing && isFresh(existing.fetchedAt, ttl) && !refetchAll())
		return unpackValue<T>(existing.value);

	if (existing) {
		// Stale served as fresh hid real failures, so a revalidation request gets the error
		if (forceFreshRequested()) return refresh(key, fetcher, ttl, existing.value);
		refresh(key, fetcher, ttl, existing.value).catch((error) =>
			log.warn(`background refresh failed for ${key}`, { code: toAppError(error).code })
		);
		return unpackValue<T>(existing.value);
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
			await writeCached(key, state, ttl, current);
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
		// A revalidation request waits for one more sync round and sees its failure
		if (forceFreshRequested()) return run(stored.value);
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
		await writeCached(key, state, ttl, stored?.value);
		return state;
	})().finally(() => checkpointSyncs.delete(key));
	checkpointSyncs.set(key, task);
	return task;
}
