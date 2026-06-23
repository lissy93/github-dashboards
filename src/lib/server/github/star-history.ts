import { inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { repoStarsDaily } from '$lib/server/db/schema';
import { rest, restResponse } from '$lib/server/github/client';
import { getUserOverview } from '$lib/server/github/user';
import { getRepo } from '$lib/server/github/repo';
import { cached, readCached, writeCached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { createLogger } from '$lib/logger';
import { AppError } from '$lib/errors';
import type { Repo } from '$lib/types';
import type { StarBreakdown } from '$lib/views/stats';

const log = createLogger('star-history');

const PER_PAGE = 100;
// Sparse page sample for huge repos, so a 50k-star repo still costs a handful of requests
const SAMPLE_PAGES = 4;
// GitHub only paginates the first 40k stargazers, so timestamps stop past this page
const PAGE_CAP = 400;
const CONCURRENCY = 6;
const MAX_REPOS = 150;
const REFRESH_REPOS = 24;
// Repos shown as their own band, the rest fold into a single Other band
const TOP_REPOS = 8;
// Keep reconstructed history long and use daily snapshots for the recent tail
const BACKFILL_TTL = 6 * 3600;
const AGGREGATE_TTL = 6 * 3600;
const STAR_ACCEPT = 'application/vnd.github.star+json';

type Stargazer = { starred_at: string };
type Point = { day: string; stars: number };
type DayStars = Point & { repo: string };
type BackfillState = { pages: number[]; lastPage: number };

// Per-repo star history across a user's owned repos, reconstructed and cached
export function getUserStarHistory(login: string): Promise<StarBreakdown> {
	return cached(
		`user:star-history:v5:${login.toLowerCase()}`,
		async () => {
			const { ownedRepos } = await getUserOverview(login);
			const starred = ownedRepos.filter((repo) => repo.stars > 0).slice(0, MAX_REPOS);
			const before = await readRows(starred.map((repo) => repo.nameWithOwner));
			const known = new Set(before.map((row) => row.repo));
			const targets = [
				...starred.filter((repo) => !known.has(repo.nameWithOwner.toLowerCase())),
				...starred.filter((repo) => known.has(repo.nameWithOwner.toLowerCase()))
			].slice(0, REFRESH_REPOS);
			let failures = 0;
			await mapLimit(targets, CONCURRENCY, async (repo) => {
				try {
					await backfillRepo(repo);
				} catch (error) {
					failures += 1;
					log.warn(`backfill failed for ${repo.nameWithOwner}`, error);
				}
			});
			const rows = await readRows(starred.map((repo) => repo.nameWithOwner));
			if (failures && !rows.length) {
				throw new AppError('upstream', 'Star history refresh failed', { expose: false });
			}
			const covered = new Set(rows.map((row) => row.repo)).size;
			return {
				...buildBreakdown(rows, starred, TOP_REPOS),
				coveredRepos: covered,
				totalRepos: starred.length
			};
		},
		AGGREGATE_TTL
	);
}

export type RepoStarHistory = { days: string[]; stars: number[]; sampled: boolean };

// One repo's reconstructed star curve, for the repo stars page and panel. Reuses
// the per-repo backfill cache and the shared interpolation, as a single series
export function getRepoStarHistory(owner: string, name: string): Promise<RepoStarHistory> {
	return cached(
		`repo:star-history:v2:${owner}/${name}`.toLowerCase(),
		async () => {
			const repo = await getRepo(owner, name);
			if (!repo || repo.stars === 0) return { days: [], stars: [], sampled: false };
			await backfillRepo(repo);
			const rows = await readRows([repo.nameWithOwner]);
			const breakdown = buildBreakdown(rows, [repo], 1);
			return {
				days: breakdown.days,
				stars: breakdown.series[0]?.values ?? [],
				// GitHub only paginates the first 40k stargazers, so bigger repos are sampled
				sampled: repo.stars > PAGE_CAP * PER_PAGE
			};
		},
		AGGREGATE_TTL
	);
}

// Add page samples over time, preserving all previously reconstructed points
async function backfillRepo(repo: Repo): Promise<number> {
	const repoKey = repo.nameWithOwner.toLowerCase();
	const cacheKey = `star-backfill-state:v1:${repoKey}`;
	const stored = await readCached<BackfillState>(cacheKey).catch(() => null);
	if (stored && Date.now() - stored.fetchedAt.getTime() < BACKFILL_TTL * 1000) {
		return stored.value.pages.length;
	}

	const first = await restResponse(pagePath(repo, 1), { headers: { Accept: STAR_ACCEPT } });
	if (!first) return 0;
	const firstPage = (await first.json()) as Stargazer[];
	if (!firstPage.length) return 0;
	const lastPage = lastPageOf(first.headers.get('link'));
	const fetched = new Set(stored?.value.lastPage === lastPage ? stored.value.pages : []);
	fetched.add(1);
	const budget = stored ? 4 : pageBudget(lastPage);
	const pages = progressPages(lastPage, fetched, budget);
	const byPage = new Map<number, Stargazer[]>([[1, firstPage]]);
	for (const page of pages) {
		if (page === 1) continue;
		try {
			byPage.set(
				page,
				(await rest<Stargazer[]>(pagePath(repo, page), {
					headers: { Accept: STAR_ACCEPT }
				})) ?? []
			);
		} catch (error) {
			log.warn(`star page ${page} failed for ${repo.nameWithOwner}`, error);
		}
	}
	byPage.forEach((_list, page) => fetched.add(page));
	await writePoints(repoKey, buildPoints(byPage, lastPage, repo.stars));
	await writeCached(
		cacheKey,
		{ pages: [...fetched].sort((a, b) => a - b), lastPage },
		BACKFILL_TTL
	);
	return fetched.size;
}

// Choose missing pages from the widest gaps first, so added samples improve evenly
export function progressPages(lastPage: number, fetched: Set<number>, budget: number): number[] {
	const selected: number[] = [];
	if (!fetched.has(lastPage)) selected.push(lastPage);
	while (selected.length < budget && fetched.size + selected.length < lastPage) {
		const known = [...new Set([1, lastPage, ...fetched, ...selected])].sort((a, b) => a - b);
		let best = 0;
		let gap = 0;
		for (let index = 1; index < known.length; index++) {
			const size = known[index] - known[index - 1];
			if (size > gap) {
				gap = size;
				best = Math.round((known[index] + known[index - 1]) / 2);
			}
		}
		if (gap <= 1 || fetched.has(best) || selected.includes(best)) break;
		selected.push(best);
	}
	return selected;
}

// Pages to fetch, scaled by repo size: small repos pull every page for full detail,
// mid repos sample more widely, huge repos stay sparse so they cost only a few requests
export function pageBudget(lastPage: number): number {
	if (lastPage <= 10) return lastPage;
	if (lastPage <= 100) return 10;
	return SAMPLE_PAGES;
}

// Plotted points to aim for once every stargazer is known, more for smaller repos where
// each star is real detail, so a 30-star curve no longer collapses to a straight line
export function pointTarget(stars: number): number {
	if (stars <= 12) return stars;
	if (stars < 100) return 40;
	if (stars < 1000) return 60;
	return 80;
}

// Every fetched stargazer as a cumulative point, strided to the target count and pinned
// to the real current total at the end
export function perStarPoints(
	pages: number[],
	byPage: Map<number, Stargazer[]>,
	stars: number
): Point[] {
	const flat: Point[] = [];
	let cumulative = 0;
	for (const page of pages) {
		for (const star of byPage.get(page) ?? []) {
			cumulative++;
			flat.push({ day: dayOf(star.starred_at), stars: cumulative });
		}
	}
	if (!flat.length) return [];
	const stride = Math.max(1, Math.round(flat.length / pointTarget(stars)));
	const points = flat.filter((_, index) => index % stride === 0);
	points.push({ day: flat[flat.length - 1].day, stars });
	return points;
}

// Per-star detail once every page is in hand, otherwise one cumulative point per
// sampled page, anchored to the live total unless GitHub's 40k cap makes it stale
export function buildPoints(
	byPage: Map<number, Stargazer[]>,
	lastPage: number,
	stars: number
): Point[] {
	const pages = [...byPage.keys()].sort((first, second) => first - second);
	if (pages.length === lastPage) return perStarPoints(pages, byPage, stars);
	const points = pages
		.map((page) => pointAt(page, byPage.get(page) ?? []))
		.filter((point): point is Point => point !== null);
	const newest = byPage.get(lastPage)?.at(-1);
	if (newest && lastPage < PAGE_CAP) points.push({ day: dayOf(newest.starred_at), stars });
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

// Interpolate repo histories on one axis and fold the long tail into Other
export function buildBreakdown(rows: DayStars[], repos: RepoMeta[], limit: number): StarBreakdown {
	if (!rows.length) return { days: [], series: [] };
	const days = [...new Set(rows.map((row) => row.day))];
	const byRepo = new Map<string, DayStars[]>();
	for (const row of rows) {
		const list = byRepo.get(row.repo) ?? [];
		list.push(row);
		byRepo.set(row.repo, list);
	}

	// Ramp between samples, then hold the latest known count
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
