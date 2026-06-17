import { sql } from 'drizzle-orm';
import { rest } from '$lib/server/github/client';
import { cached } from '$lib/server/cache';
import { db } from '$lib/server/db';
import { repoTrafficDaily } from '$lib/server/db/schema';
import { config } from '$lib/server/env';
import { AppError } from '$lib/errors';

export type TrafficCount = { count: number; uniques: number };
export type TrafficItem = { label: string; sublabel?: string; count: number; uniques: number };
export type RepoTrafficSummary = { available: boolean; views: TrafficCount; clones: TrafficCount };
export type RepoTraffic = RepoTrafficSummary & {
	topPaths: TrafficItem[];
	topReferrers: TrafficItem[];
};

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

// Whether traffic, which is private to repo admins, may be shown for this login
export function canSeeTraffic(user: string): boolean {
	return config.TRAFFIC_OWNER !== '' && config.TRAFFIC_OWNER.toLowerCase() === user.toLowerCase();
}

// REST call that treats a permission 403 as "no access" rather than an error
async function tryRest<T>(path: string): Promise<T | null> {
	try {
		return await rest<T>(path);
	} catch (error) {
		if (error instanceof AppError && error.code === 'forbidden') return null;
		throw error;
	}
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
		tryRest<ViewsResponse>(`${base}/views`),
		tryRest<ClonesResponse>(`${base}/clones`)
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
	return cached(`repo:traffic-summary:${owner}/${repo}`.toLowerCase(), () =>
		fetchSummary(owner, repo)
	);
}

// Full insights for one repo: summary plus top paths and referrers
export function getRepoTraffic(owner: string, repo: string): Promise<RepoTraffic> {
	return cached(`repo:traffic:${owner}/${repo}`.toLowerCase(), async () => {
		const summary = await getRepoTrafficSummary(owner, repo);
		if (!summary.available) return { ...summary, topPaths: [], topReferrers: [] };

		const base = `/repos/${owner}/${repo}/traffic/popular`;
		const [paths, referrers] = await Promise.all([
			tryRest<PathResponse[]>(`${base}/paths`),
			tryRest<ReferrerResponse[]>(`${base}/referrers`)
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
