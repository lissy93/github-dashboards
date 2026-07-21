import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { outcomeHistory } from '$lib/server/db/schema';
import { rootReason } from '$lib/utils/errors';
import { createLogger } from '$lib/utils/logger';
import type { OutcomeBucket } from '$lib/utils/outcomes';

const log = createLogger('outcome-history');

const overwrite = {
	success: sql`excluded.success`,
	failure: sql`excluded.failure`,
	other: sql`excluded.other`
};

// The oldest day of a truncated window may be cut mid-day, so it only raises stored counts
const raiseOnly = {
	success: sql`greatest(excluded.success, ${outcomeHistory.success})`,
	failure: sql`greatest(excluded.failure, ${outcomeHistory.failure})`,
	other: sql`greatest(excluded.other, ${outcomeHistory.other})`
};

// Merge a bounded window of daily buckets into stored history and return the full series.
// Fresh days overwrite (authoritative), aged-out days stay, so transitions never double count
export async function accumulateOutcomes(
	scope: string,
	kind: string,
	fresh: OutcomeBucket[],
	truncated = false
): Promise<OutcomeBucket[]> {
	const key = scope.toLowerCase();
	const upsert = (rows: OutcomeBucket[], set: typeof overwrite) =>
		rows.length
			? db
					.insert(outcomeHistory)
					.values(
						rows.map((bucket) => ({
							scope: key,
							kind,
							day: bucket.date,
							success: bucket.success,
							failure: bucket.failure,
							other: bucket.other
						}))
					)
					.onConflictDoUpdate({
						target: [outcomeHistory.scope, outcomeHistory.kind, outcomeHistory.day],
						set
					})
			: Promise.resolve();
	try {
		const [partial, whole] = truncated ? [fresh.slice(0, 1), fresh.slice(1)] : [[], fresh];
		await upsert(whole, overwrite);
		await upsert(partial, raiseOnly);
		const rows = await db
			.select({
				day: outcomeHistory.day,
				success: outcomeHistory.success,
				failure: outcomeHistory.failure,
				other: outcomeHistory.other
			})
			.from(outcomeHistory)
			.where(and(eq(outcomeHistory.scope, key), eq(outcomeHistory.kind, kind)));
		return rows
			.map((row) => ({
				date: row.day,
				success: row.success,
				failure: row.failure,
				other: row.other
			}))
			.sort((first, second) => first.date.localeCompare(second.date));
	} catch (error) {
		// Storage trouble, fall back to the current window so the trend still renders
		log.warn(`outcome history unavailable for ${kind} ${key}`, { reason: rootReason(error) });
		return fresh;
	}
}
