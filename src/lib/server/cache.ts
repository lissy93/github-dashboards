import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cacheEntry } from '$lib/server/db/schema';
import { config } from '$lib/server/env';
import { createLogger } from '$lib/logger';
import { toAppError } from '$lib/errors';

const log = createLogger('cache');

// Dedupes concurrent fetches for the same key so we never fire duplicate work
const inflight = new Map<string, Promise<unknown>>();

function isFresh(fetchedAt: Date, ttl: number): boolean {
	return Date.now() - fetchedAt.getTime() < ttl * 1000;
}

// Whether a key has any stored value, fresh or stale (served instantly either way)
export async function isCached(key: string): Promise<boolean> {
	const [existing] = await db
		.select({ key: cacheEntry.key })
		.from(cacheEntry)
		.where(eq(cacheEntry.key, key))
		.limit(1);
	return Boolean(existing);
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
	const [existing] = await db.select().from(cacheEntry).where(eq(cacheEntry.key, key)).limit(1);
	if (existing && isFresh(existing.fetchedAt, ttl)) return existing.value as T;

	if (existing) {
		refresh(key, fetcher, ttl).catch((error) =>
			log.warn(`background refresh failed for ${key}`, { code: toAppError(error).code })
		);
		return existing.value as T;
	}

	return refresh(key, fetcher, ttl);
}
