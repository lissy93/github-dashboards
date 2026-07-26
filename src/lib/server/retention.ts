import { sql } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { activityEvent, cacheEntry, repoChurnWeekly, repoStarsDaily } from '$lib/server/db/schema';
import { ACTIVITY_SYNC_PREFIX } from '$lib/server/github/activity';
import { CONTRIBUTORS_KEY_PREFIX } from '$lib/server/github/contributors';
import { rootReason } from '$lib/utils/errors';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('retention');

// Star history is rederivable from GitHub, so drop repos not snapshotted within this window
const STARS_RETENTION_DAYS = 30;

// Drop rows whose entity no longer has a cache entry, the same "no longer viewed" signal the
// cache purge uses. keyPrefix || entity rebuilds that entity's cache key
async function pruneOrphaned(
	table: PgTable,
	entity: AnyPgColumn,
	keyPrefix: string
): Promise<void> {
	await db
		.delete(table)
		.where(
			sql`not exists (select 1 from ${cacheEntry} where ${cacheEntry.key} = ${keyPrefix} || ${entity})`
		);
}

// Drop repos whose newest star snapshot has aged past the retention window
async function pruneStaleStars(): Promise<void> {
	const cutoff = new Date(Date.now() - STARS_RETENTION_DAYS * 86400000).toISOString().slice(0, 10);
	await db.delete(repoStarsDaily).where(
		sql`${repoStarsDaily.repo} in (
				select repo from ${repoStarsDaily} group by repo having max(day) < ${cutoff}::date)`
	);
}

// Prune every accumulating snapshot table, best effort so one failure never aborts the rest
export async function pruneSnapshots(): Promise<void> {
	const jobs: Array<[string, () => Promise<void>]> = [
		['churn', () => pruneOrphaned(repoChurnWeekly, repoChurnWeekly.repo, CONTRIBUTORS_KEY_PREFIX)],
		['activity', () => pruneOrphaned(activityEvent, activityEvent.user, ACTIVITY_SYNC_PREFIX)],
		['stars', pruneStaleStars]
	];
	for (const [name, run] of jobs) {
		try {
			await run();
		} catch (error) {
			log.warn(`snapshot prune failed for ${name}`, { reason: rootReason(error) });
		}
	}
}
