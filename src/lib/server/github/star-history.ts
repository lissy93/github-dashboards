import type { Repo, RepoStarHistory } from '$lib/types';
import { inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { repoStarsDaily } from '$lib/server/db/schema';
import { graphql, isRefusedList, looksRestricted } from '$lib/server/github/client';
import { usingAppToken, withAppToken } from '$lib/server/auth/context';
import { getUserOverview } from '$lib/server/github/user';
import { getRepo } from '$lib/server/github/repo';
import { preferTotals } from '$lib/server/github/stars';
import { cached, readCached, writeCached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { createLogger } from '$lib/utils/logger';
import { AppError, rootReason } from '$lib/utils/errors';
import type { StarBreakdown } from '$lib/views/stats';

const log = createLogger('star-history');

const PER_PAGE = 100;
// Pages pulled from each end of the stargazer list before the middle is interpolated.
// GraphQL cursors only walk forward from the oldest star, so the middle of a huge repo
// cannot be sampled cheaply; we read both ends and let the draw-time ramp fill the gap
const MID_END_PAGES = 10;
const HUGE_END_PAGES = 4;
const CONCURRENCY = 6;
const MAX_REPOS = 150;
// Repos backfilled per call, top and uncached first. Each walks both ends, so keep this
// modest to stay under the client timeout on cold cache; the rest fill in over visits
const REFRESH_REPOS = 12;
// Repos shown as their own band, the rest fold into a single Other band
const TOP_REPOS = 8;
// The curve moves slowly, and each run also pins today's total as a fresh daily point
const BACKFILL_TTL = 6 * 3600;
const AGGREGATE_TTL = 6 * 3600;

type Point = { day: string; stars: number };
type DayStars = Point & { repo: string };
type BackfillState = { restricted: boolean };

// Per-repo star history across a user's owned repos, reconstructed and cached
export function getUserStarHistory(login: string): Promise<StarBreakdown> {
	return cached(
		`user:star-history:v7:${login.toLowerCase()}`,
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
			let refused = 0;
			await mapLimit(targets, CONCURRENCY, async (repo) => {
				try {
					if (await backfillRepo(repo)) refused += 1;
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
				totalRepos: starred.length,
				// Only a real refusal is the gate, nothing stored yet is just history still building
				restricted: refused > 0 && covered === 0
			};
		},
		AGGREGATE_TTL
	);
}

// One repo's reconstructed star curve, for the repo stars page and panel. Reuses
// the per-repo backfill cache and the shared interpolation, as a single series
export function getRepoStarHistory(owner: string, name: string): Promise<RepoStarHistory> {
	return cached(
		`repo:star-history:v4:${owner}/${name}`.toLowerCase(),
		async () => {
			const repo = await getRepo(owner, name);
			if (!repo || repo.stars === 0)
				return { days: [], stars: [], sampled: false, restricted: false };
			const restricted = await backfillRepo(repo);
			const rows = await readRows([repo.nameWithOwner]);
			// Stored history from an earlier allowed walk beats the gate, one daily total is not history
			if (restricted && rows.length < 2)
				return { days: [], stars: [], sampled: false, restricted: true };
			const breakdown = buildBreakdown(rows, [repo], 1);
			return {
				days: breakdown.days,
				stars: breakdown.series[0]?.values ?? [],
				sampled: isSampled(repo.stars),
				restricted: false
			};
		},
		AGGREGATE_TTL
	);
}

type StarConn = {
	totalCount: number;
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
	edges: { starredAt: string }[];
};

// totalCount tells an emptied list from a genuinely unstarred repo, where the walk is allowed
const STAR_QUERY = `
	query RepoStars($owner: String!, $name: String!, $cursor: String, $direction: OrderDirection!) {
		repository(owner: $owner, name: $name) {
			stargazers(first: ${PER_PAGE}, after: $cursor, orderBy: { field: STARRED_AT, direction: $direction }) {
				totalCount
				pageInfo { hasNextPage endCursor }
				edges { starredAt }
			}
		}
	}
`;

type Direction = 'ASC' | 'DESC';

async function fetchStarPage(
	repo: Repo,
	direction: Direction,
	cursor: string | null
): Promise<StarConn | null> {
	const data = await graphql<{ repository: { stargazers: StarConn } | null }>(STAR_QUERY, {
		owner: repo.owner,
		name: repo.name,
		cursor,
		direction
	});
	return data.repository?.stargazers ?? null;
}

type Walk = { days: string[]; total: number; responded: boolean; refused: boolean };

// Walk stargazer pages in one direction up to maxPages, collecting star dates in fetch
// order. total is GitHub's authoritative count, read even when the list itself is hidden;
// responded is false only when no page came back at all, which marks a transient miss
async function walkStars(repo: Repo, direction: Direction, maxPages: number): Promise<Walk> {
	const days: string[] = [];
	let total = repo.stars;
	let responded = false;
	let refused = false;
	let cursor: string | null = null;
	for (let page = 0; page < maxPages; page++) {
		// GitHub now refuses the whole list to non-admins, which is the gate, not a failure
		const conn: StarConn | null = await fetchStarPage(repo, direction, cursor).catch(
			(error: unknown) => {
				if (!isRefusedList(error)) throw error;
				refused = true;
				return null;
			}
		);
		if (!conn) break;
		responded = true;
		total = conn.totalCount;
		for (const edge of conn.edges) days.push(dayOf(edge.starredAt));
		if (!conn.edges.length || !conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
		cursor = conn.pageInfo.endCursor;
	}
	return { days, total, responded, refused };
}

// One walk of the stargazer list under the current token. Small repos are read whole
// for per-star detail; larger repos read both ends and interpolate the middle
async function walkCurve(repo: Repo): Promise<{
	points: Point[];
	total: number;
	responded: boolean;
	refused: boolean;
}> {
	const lastPage = Math.max(1, Math.ceil(repo.stars / PER_PAGE));
	if (isFullWalk(lastPage)) {
		const { days, total, responded, refused } = await walkStars(repo, 'ASC', lastPage);
		return { points: curvePoints(days, [], total), total, responded, refused };
	}
	const budget = pageBudget(lastPage);
	const [oldest, newest] = await Promise.all([
		walkStars(repo, 'ASC', budget),
		walkStars(repo, 'DESC', budget)
	]);
	const total = newest.responded ? newest.total : oldest.total;
	return {
		points: curvePoints(oldest.days, newest.days, total),
		total,
		responded: oldest.responded || newest.responded,
		refused: oldest.refused || newest.refused
	};
}

// Reconstruct and store a repo's star curve, returning true when GitHub's admin-only
// restriction leaves a starred repo with no visible stargazers
async function backfillRepo(repo: Repo): Promise<boolean> {
	const repoKey = repo.nameWithOwner.toLowerCase();
	const cacheKey = `star-backfill-state:v3:${repoKey}`;
	const stored = await readCached<BackfillState>(cacheKey).catch(() => null);
	if (stored && Date.now() - stored.fetchedAt.getTime() < BACKFILL_TTL * 1000) {
		// A restricted verdict only reflects the token that fetched it, let a viewer retry
		if (!stored.value.restricted || usingAppToken()) return stored.value.restricted;
	}

	let walk = await walkCurve(repo);
	// A gated walk costs a page or two, so retry on the app token which may be admin here
	if (walk.responded && looksRestricted(walk.total, walk.points.length) && !usingAppToken()) {
		walk = await withAppToken(() => walkCurve(repo));
	}

	// A silent miss is transient, not a restriction; throw uncached so the next visit
	// retries instead of pinning a false gate for hours. A refusal is the gate itself
	if (!walk.responded && !walk.refused)
		throw new AppError('upstream', `No stargazer response for ${repo.nameWithOwner}`, {
			expose: false
		});

	const restricted = walk.refused || looksRestricted(walk.total, walk.points.length);
	if (walk.points.length) {
		walk.points.push({ day: today(), stars: walk.total });
		await writePoints(repoKey, walk.points);
	}
	await writeCached(cacheKey, { restricted }, BACKFILL_TTL);
	return restricted;
}

// Pages to read from each end, scaled by repo size. The largest repos stay sparse so a
// 50k-star repo still costs only a handful of pages
export function pageBudget(lastPage: number): number {
	return lastPage <= 100 ? MID_END_PAGES : HUGE_END_PAGES;
}

// Whether both ends together already cover every page, so one ascending walk yields full
// per-star detail. Otherwise the middle is sampled and the curve is flagged as such
export function isFullWalk(lastPage: number): boolean {
	return pageBudget(lastPage) * 2 >= lastPage;
}

// Whether a repo of this many stars gets a sampled rather than per-star curve
export const isSampled = (stars: number): boolean =>
	!isFullWalk(Math.max(1, Math.ceil(stars / PER_PAGE)));

// Plotted points to aim for, more for smaller repos where each star is real detail, so a
// 30-star curve no longer collapses to a straight line
export function pointTarget(stars: number): number {
	if (stars <= 12) return stars;
	if (stars < 100) return 40;
	if (stars < 1000) return 60;
	return 80;
}

// Cumulative star points from the oldest and newest sampled ends. Each oldest star is the
// (i+1)th overall, each newest star counts down from the total; counts rise with time so
// the two clusters form one rising series, thinned to a target point count
export function curvePoints(oldest: string[], newest: string[], total: number): Point[] {
	const points: Point[] = oldest.map((day, index) => ({ day, stars: index + 1 }));
	newest.forEach((day, index) => points.push({ day, stars: total - index }));
	if (!points.length) return [];
	points.sort((first, second) => first.stars - second.stars);
	return stride(points, pointTarget(total));
}

// Thin a rising series down to about target points, always keeping the first and last
export function stride(points: Point[], target: number): Point[] {
	if (points.length <= target) return points;
	const step = Math.ceil(points.length / target);
	const out = points.filter((_, index) => index % step === 0);
	const last = points[points.length - 1];
	if (out[out.length - 1] !== last) out.push(last);
	return out;
}

const dayOf = (iso: string) => iso.slice(0, 10);
const today = () => dayOf(new Date().toISOString());

// Store the interpolated curve, highest count per day wins so re-runs only grow it. source
// 'curve' keeps it from ever overwriting a genuine daily total in the same rows
async function writePoints(repo: string, points: Point[]): Promise<void> {
	const byDay = new Map<string, number>();
	for (const point of points)
		byDay.set(point.day, Math.max(byDay.get(point.day) ?? 0, point.stars));
	if (!byDay.size) return;
	const rows = [...byDay].map(([day, stars]) => ({ repo, day, stars, source: 'curve' }));
	try {
		await db
			.insert(repoStarsDaily)
			.values(rows)
			.onConflictDoUpdate({
				target: [repoStarsDaily.repo, repoStarsDaily.day, repoStarsDaily.source],
				set: { stars: sql`excluded.stars` }
			});
	} catch (error) {
		// The walk already has the curve, a failed persist only costs stored history
		log.warn(`could not store star points for ${repo}`, { reason: rootReason(error) });
	}
}

async function readRows(names: string[]): Promise<DayStars[]> {
	if (!names.length) return [];
	const keys = names.map((name) => name.toLowerCase());
	const rows = await db
		.select({
			repo: repoStarsDaily.repo,
			day: repoStarsDaily.day,
			stars: repoStarsDaily.stars,
			source: repoStarsDaily.source
		})
		.from(repoStarsDaily)
		.where(inArray(repoStarsDaily.repo, keys));
	// One point per repo+day, genuine totals winning over interpolated curve points
	return preferTotals(rows)
		.map(({ repo, day, stars }) => ({ repo, day, stars }))
		.sort((first, second) => first.day.localeCompare(second.day));
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
