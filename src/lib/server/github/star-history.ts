import { inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { repoStarsDaily } from '$lib/server/db/schema';
import { rest, restResponse } from '$lib/server/github/client';
import { getUserOverview } from '$lib/server/github/user';
import { cached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { createLogger } from '$lib/logger';
import type { Repo } from '$lib/types';
import type { StarBreakdown } from '$lib/views/stats';

const log = createLogger('star-history');

const PER_PAGE = 100;
// Pages sampled per repo, so a 50k-star repo still costs a handful of requests
const SAMPLE_PAGES = 15;
// GitHub only paginates the first 40k stargazers, so timestamps stop past this page
const PAGE_CAP = 400;
const CONCURRENCY = 6;
const MAX_REPOS = 150;
// Repos shown as their own band, the rest fold into a single Other band
const TOP_REPOS = 8;
// History is immutable, so hold a repo's backfill long and lean on daily snapshots
// for the recent tail
const BACKFILL_TTL = 30 * 86400;
const AGGREGATE_TTL = 6 * 3600;
const STAR_ACCEPT = 'application/vnd.github.star+json';

type Stargazer = { starred_at: string };
type Point = { day: string; stars: number };
type DayStars = Point & { repo: string };

// Per-repo star history across a user's owned repos, reconstructed and cached
export function getUserStarHistory(login: string): Promise<StarBreakdown> {
	return cached(
		`user:star-history:v3:${login.toLowerCase()}`,
		async () => {
			const { ownedRepos } = await getUserOverview(login);
			const targets = ownedRepos.filter((repo) => repo.stars > 0).slice(0, MAX_REPOS);
			await mapLimit(targets, CONCURRENCY, async (repo) => {
				try {
					await backfillRepo(repo);
				} catch (error) {
					log.warn(`backfill failed for ${repo.nameWithOwner}`, error);
				}
			});
			const rows = await readRows(ownedRepos.map((repo) => repo.nameWithOwner));
			return buildBreakdown(rows, ownedRepos, TOP_REPOS);
		},
		AGGREGATE_TTL
	);
}

// Reconstruct one repo's star curve once, then reuse it until the long TTL lapses
function backfillRepo(repo: Repo): Promise<number> {
	const key = repo.nameWithOwner.toLowerCase();
	return cached(
		`star-backfill:${key}`,
		async () => {
			const points = await reconstruct(repo);
			await writePoints(key, points);
			return points.length;
		},
		BACKFILL_TTL
	);
}

// Sample stargazer timestamps into cumulative (day, stars) points
async function reconstruct(repo: Repo): Promise<Point[]> {
	const first = await restResponse(pagePath(repo, 1), { headers: { Accept: STAR_ACCEPT } });
	if (!first) return [];
	const firstPage = (await first.json()) as Stargazer[];
	if (!firstPage.length) return [];

	const lastPage = lastPageOf(first.headers.get('link'));
	const points: Point[] = [pointAt(1, firstPage)!];

	let newest = firstPage.at(-1);
	for (const page of samplePages(lastPage, SAMPLE_PAGES)) {
		if (page === 1) continue;
		const list =
			(await rest<Stargazer[]>(pagePath(repo, page), { headers: { Accept: STAR_ACCEPT } })) ?? [];
		const point = pointAt(page, list);
		if (point) points.push(point);
		newest = list.at(-1) ?? newest;
	}
	// Anchor the recent end at the true current total, unless the stargazer feed was
	// capped: past 40k the newest reachable star is old, so daily snapshots take over
	if (newest && lastPage < PAGE_CAP)
		points.push({ day: dayOf(newest.starred_at), stars: repo.stars });
	return points;
}

const pagePath = (repo: Repo, page: number) =>
	`/repos/${repo.owner}/${repo.name}/stargazers?per_page=${PER_PAGE}&page=${page}`;

// The first star on a page is the ((page-1)*100 + 1)th oldest, giving its running total
function pointAt(page: number, list: Stargazer[]): Point | null {
	const star = list[0];
	return star ? { day: dayOf(star.starred_at), stars: (page - 1) * PER_PAGE + 1 } : null;
}

const dayOf = (iso: string) => iso.slice(0, 10);

// Page numbers spread evenly across 1..lastPage, always including both ends
export function samplePages(lastPage: number, max: number): number[] {
	if (lastPage <= max) return Array.from({ length: lastPage }, (_, index) => index + 1);
	const pages = new Set<number>();
	for (let step = 0; step < max; step++) {
		pages.add(1 + Math.round((step * (lastPage - 1)) / (max - 1)));
	}
	return [...pages].sort((first, second) => first - second);
}

// Last page number from a Link header, or 1 when there is no next page
function lastPageOf(link: string | null): number {
	const match = link?.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
	return match ? Number(match[1]) : 1;
}

// Store the curve, keeping the highest count per day so re-runs only grow it
async function writePoints(repo: string, points: Point[]): Promise<void> {
	const byDay = new Map<string, number>();
	for (const point of points)
		byDay.set(point.day, Math.max(byDay.get(point.day) ?? 0, point.stars));
	if (!byDay.size) return;
	const rows = [...byDay].map(([day, stars]) => ({ repo, day, stars }));
	await db
		.insert(repoStarsDaily)
		.values(rows)
		.onConflictDoUpdate({
			target: [repoStarsDaily.repo, repoStarsDaily.day],
			set: { stars: sql`excluded.stars` }
		});
}

async function readRows(names: string[]): Promise<DayStars[]> {
	if (!names.length) return [];
	const keys = names.map((name) => name.toLowerCase());
	return db
		.select({ repo: repoStarsDaily.repo, day: repoStarsDaily.day, stars: repoStarsDaily.stars })
		.from(repoStarsDaily)
		.where(inArray(repoStarsDaily.repo, keys))
		.orderBy(repoStarsDaily.day);
}

type RepoMeta = { nameWithOwner: string; name: string; stars: number };

// Interpolate each repo's value across a shared day axis, keeping the top repos
// as their own series and folding the rest into one Other band. Rows arrive day-sorted
export function buildBreakdown(rows: DayStars[], repos: RepoMeta[], limit: number): StarBreakdown {
	if (!rows.length) return { days: [], series: [] };
	const days = [...new Set(rows.map((row) => row.day))];
	const byRepo = new Map<string, DayStars[]>();
	for (const row of rows) {
		const list = byRepo.get(row.repo) ?? [];
		list.push(row);
		byRepo.set(row.repo, list);
	}

	// One repo's count on the shared axis: 0 before its first sample, linearly
	// interpolated between known samples, then held past the last one. Stars accrue
	// steadily between samples, so a ramp reads truer than a hold-then-jump staircase
	const carry = (key: string): number[] => {
		const points = byRepo.get(key) ?? [];
		const times = points.map((point) => Date.parse(point.day));
		return days.map((day) => {
			const time = Date.parse(day);
			if (!points.length || time < times[0]) return 0;
			let index = 0;
			while (index + 1 < points.length && times[index + 1] <= time) index++;
			const next = points[index + 1];
			if (!next) return points[index].stars;
			const frac = (time - times[index]) / (times[index + 1] - times[index] || 1);
			return Math.round(points[index].stars + (next.stars - points[index].stars) * frac);
		});
	};

	const ranked = repos
		.map((repo) => ({ key: repo.nameWithOwner.toLowerCase(), name: repo.name, stars: repo.stars }))
		.filter((repo) => byRepo.has(repo.key))
		.sort((first, second) => second.stars - first.stars);

	const series = ranked
		.slice(0, limit)
		.map((repo) => ({ label: repo.name, values: carry(repo.key) }));
	const rest = ranked.slice(limit).map((repo) => carry(repo.key));
	if (rest.length) {
		const other = days.map((_, index) => rest.reduce((sum, values) => sum + values[index], 0));
		series.push({ label: 'Other', values: other });
	}
	return { days, series };
}
