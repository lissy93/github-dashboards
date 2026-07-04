import type { TrafficCount, RepoTrafficSummary, RepoTraffic } from '$lib/types';
import { inArray, sql } from 'drizzle-orm';
import { restTolerant } from '$lib/server/github/client';
import { cached } from '$lib/server/cache';
import { db } from '$lib/server/db';
import { repoTrafficDaily } from '$lib/server/db/schema';
import type { TrafficDay } from '$lib/types';

type DailyPoint = { timestamp: string; count: number; uniques: number };
type ViewsResponse = TrafficCount & { views: DailyPoint[] };
type ClonesResponse = TrafficCount & { clones: DailyPoint[] };
type PathResponse = { path: string; title: string; count: number; uniques: number };
type ReferrerResponse = { referrer: string; count: number; uniques: number };

const EMPTY: RepoTrafficSummary = {
	available: false,
	views: { count: 0, uniques: 0 },
	clones: { count: 0, uniques: 0 }
};

// Traffic is private to repo admins, so only the signed-in owner viewing their
// own board may see it. viewerLogin comes from the session, null when logged out
export function canSeeTraffic(owner: string, viewerLogin: string | null | undefined): boolean {
	return !!viewerLogin && viewerLogin.toLowerCase() === owner.toLowerCase();
}

// Combine the 14 day view and clone series into one row per day
export function mergeTrafficDays(views: DailyPoint[], clones: DailyPoint[]) {
	const byDay = new Map<
		string,
		{ day: string; views: number; uniqueViews: number; clones: number; uniqueClones: number }
	>();
	const row = (timestamp: string) => {
		const day = timestamp.slice(0, 10);
		let existing = byDay.get(day);
		if (!existing) {
			existing = { day, views: 0, uniqueViews: 0, clones: 0, uniqueClones: 0 };
			byDay.set(day, existing);
		}
		return existing;
	};
	for (const point of views)
		Object.assign(row(point.timestamp), { views: point.count, uniqueViews: point.uniques });
	for (const point of clones)
		Object.assign(row(point.timestamp), { clones: point.count, uniqueClones: point.uniques });
	return [...byDay.values()];
}

// Persist each day's traffic, GitHub only keeps a rolling 14 day window
async function snapshot(repo: string, views: ViewsResponse, clones: ClonesResponse | null) {
	const rows = mergeTrafficDays(views.views, clones?.clones ?? []).map((day) => ({ repo, ...day }));
	if (!rows.length) return;
	await db
		.insert(repoTrafficDaily)
		.values(rows)
		.onConflictDoUpdate({
			target: [repoTrafficDaily.repo, repoTrafficDaily.day],
			set: {
				views: sql`excluded.views`,
				uniqueViews: sql`excluded.unique_views`,
				clones: sql`excluded.clones`,
				uniqueClones: sql`excluded.unique_clones`
			}
		});
}

async function fetchSummary(owner: string, repo: string): Promise<RepoTrafficSummary> {
	const base = `/repos/${owner}/${repo}/traffic`;
	const [views, clones] = await Promise.all([
		restTolerant<ViewsResponse>(`${base}/views`),
		restTolerant<ClonesResponse>(`${base}/clones`)
	]);
	if (!views) return EMPTY;
	await snapshot(`${owner}/${repo}`.toLowerCase(), views, clones);
	return {
		available: true,
		views: { count: views.count, uniques: views.uniques },
		clones: { count: clones?.count ?? 0, uniques: clones?.uniques ?? 0 }
	};
}

// Views and clones for a repo, cached and snapshotted. Used for list sorting
export function getRepoTrafficSummary(owner: string, repo: string): Promise<RepoTrafficSummary> {
	return cached(`repo:traffic-summary:v1:${owner}/${repo}`.toLowerCase(), () =>
		fetchSummary(owner, repo)
	);
}

// All stored daily traffic for a set of repos, our accumulated history beyond
// GitHub's rolling 14 day window. Keyed back to each name's original case
export async function getTrafficHistory(names: string[]): Promise<TrafficDay[]> {
	if (!names.length) return [];
	const byKey = new Map(names.map((name) => [name.toLowerCase(), name]));
	const rows = await db
		.select()
		.from(repoTrafficDaily)
		.where(inArray(repoTrafficDaily.repo, [...byKey.keys()]));
	return rows.map((row) => ({
		repo: byKey.get(row.repo) ?? row.repo,
		day: row.day,
		views: row.views,
		uniqueViews: row.uniqueViews,
		clones: row.clones,
		uniqueClones: row.uniqueClones
	}));
}

// Full insights for one repo: summary plus top paths and referrers
export function getRepoTraffic(owner: string, repo: string): Promise<RepoTraffic> {
	return cached(`repo:traffic:v1:${owner}/${repo}`.toLowerCase(), async () => {
		const summary = await getRepoTrafficSummary(owner, repo);
		if (!summary.available) return { ...summary, topPaths: [], topReferrers: [] };

		const base = `/repos/${owner}/${repo}/traffic/popular`;
		const [paths, referrers] = await Promise.all([
			restTolerant<PathResponse[]>(`${base}/paths`),
			restTolerant<ReferrerResponse[]>(`${base}/referrers`)
		]);
		return {
			...summary,
			topPaths: (paths ?? []).map((item) => ({
				label: item.title,
				sublabel: item.path,
				count: item.count,
				uniques: item.uniques
			})),
			topReferrers: (referrers ?? []).map((item) => ({
				label: item.referrer,
				count: item.count,
				uniques: item.uniques
			}))
		};
	});
}
