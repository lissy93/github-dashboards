import { and, gte, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { repoStarsDaily } from '$lib/server/db/schema';
import { STAR_WINDOWS } from '$lib/config';
import type { Repo } from '$lib/types';

export type StarRow = { day: string; stars: number };
export type StarBaselines = Record<string, number | null>;
export type StarSnapshot = { repo: string; day: string; stars: number; source: string };

// Collapse to one value per repo+day, preferring a genuine total over an interpolated point
export function preferTotals(rows: StarSnapshot[]): StarSnapshot[] {
	const byKey = new Map<string, StarSnapshot>();
	for (const row of rows) {
		const key = `${row.repo}|${row.day}`;
		const current = byKey.get(key);
		if (!current || (row.source === 'total' && current.source !== 'total')) byKey.set(key, row);
	}
	return [...byKey.values()];
}

const MAX_WINDOW = Math.max(...STAR_WINDOWS);

// UTC day string offset days back from now, e.g. "2026-06-16"
function dayString(offset = 0): string {
	return new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
}

// Store today's genuine star count per repo so deltas can be derived later
export async function snapshotStars(repos: Repo[]): Promise<void> {
	if (!repos.length) return;
	const day = dayString();
	const rows = repos.map((repo) => ({
		repo: repo.nameWithOwner.toLowerCase(),
		day,
		stars: repo.stars,
		source: 'total'
	}));
	await db
		.insert(repoStarsDaily)
		.values(rows)
		.onConflictDoUpdate({
			target: [repoStarsDaily.repo, repoStarsDaily.day, repoStarsDaily.source],
			set: { stars: sql`excluded.stars` }
		});
}

// Stars as of each window cutoff, using the newest snapshot on or before it.
// Returns null when the nearest snapshot is too old to honestly label the window,
// since a wrong delta is worse than none
export function pickBaselines(rows: StarRow[], today: string): StarBaselines {
	const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
	const out: StarBaselines = {};
	for (const window of STAR_WINDOWS) {
		const cutoff = dayBefore(today, window);
		const match = [...sorted].reverse().find((row) => row.day <= cutoff);
		const tolerance = Math.max(1, Math.ceil(window * 0.25));
		const drift = match ? (Date.parse(cutoff) - Date.parse(match.day)) / 86400000 : Infinity;
		out[window] = match && drift <= tolerance ? match.stars : null;
	}
	return out;
}

// Subtract days from a "YYYY-MM-DD" string and return the same format
function dayBefore(today: string, days: number): string {
	return new Date(Date.parse(today) - days * 86400000).toISOString().slice(0, 10);
}

// Window baselines for each repo, keyed by nameWithOwner in its original case
export async function getStarBaselines(names: string[]): Promise<Record<string, StarBaselines>> {
	if (!names.length) return {};
	const byKey = new Map(names.map((name) => [name.toLowerCase(), name]));
	const rows = await db
		.select({
			repo: repoStarsDaily.repo,
			day: repoStarsDaily.day,
			stars: repoStarsDaily.stars,
			source: repoStarsDaily.source
		})
		.from(repoStarsDaily)
		.where(
			and(
				inArray(repoStarsDaily.repo, [...byKey.keys()]),
				gte(repoStarsDaily.day, dayString(MAX_WINDOW))
			)
		);

	const grouped = new Map<string, StarRow[]>();
	for (const row of preferTotals(rows)) {
		const list = grouped.get(row.repo) ?? [];
		list.push({ day: row.day, stars: row.stars });
		grouped.set(row.repo, list);
	}

	const today = dayString();
	const out: Record<string, StarBaselines> = {};
	for (const [key, original] of byKey) {
		const list = grouped.get(key);
		if (list?.length) out[original] = pickBaselines(list, today);
	}
	return out;
}
