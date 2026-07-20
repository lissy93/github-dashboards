import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { outcomeHistory } from '$lib/server/db/schema';
import { isConnectionError, toAppError } from '$lib/utils/errors';
import { createLogger } from '$lib/utils/logger';
import type { OutcomeBucket } from '$lib/utils/outcomes';

const log = createLogger('outcome-history');

// Merge a bounded window of daily buckets into stored history and return the full series.
// Fresh days overwrite (authoritative), aged-out days stay, so transitions never double count.
// A truncated fetch may have cut its oldest day mid-day, so that day can only raise the
// stored count, never replace a complete one with a partial tail
export async function accumulateOutcomes(
	scope: string,
	kind: string,
	fresh: OutcomeBucket[],
	truncated = false
): Promise<OutcomeBucket[]> {
	const key = scope.toLowerCase();
	const toRow = (bucket: OutcomeBucket) => ({
		scope: key,
		kind,
		day: bucket.date,
		success: bucket.success,
		failure: bucket.failure,
		other: bucket.other
	});
	const target = [outcomeHistory.scope, outcomeHistory.kind, outcomeHistory.day];
	try {
		const [partial, whole] = truncated ? [fresh.slice(0, 1), fresh.slice(1)] : [[], fresh];
		if (whole.length) {
			await db
				.insert(outcomeHistory)
				.values(whole.map(toRow))
				.onConflictDoUpdate({
					target,
					set: {
						success: sql`excluded.success`,
						failure: sql`excluded.failure`,
						other: sql`excluded.other`
					}
				});
		}
		if (partial.length) {
			await db
				.insert(outcomeHistory)
				.values(partial.map(toRow))
				.onConflictDoUpdate({
					target,
					set: {
						success: sql`greatest(excluded.success, ${outcomeHistory.success})`,
						failure: sql`greatest(excluded.failure, ${outcomeHistory.failure})`,
						other: sql`greatest(excluded.other, ${outcomeHistory.other})`
					}
				});
		}
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
		// Storage down, fall back to the current window so the trend still renders
		if (!isConnectionError(error)) throw error;
		log.warn(`outcome history unavailable for ${kind} ${key}`, { code: toAppError(error).code });
		return fresh;
	}
}
