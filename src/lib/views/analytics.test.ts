import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	aggregate,
	fillGaps,
	totals,
	topPaths,
	topReferrers,
	viewsByRepo,
	defaultAnalyticsView,
	scopeLabel,
	deltaHint,
	SNAPSHOT_RANGE,
	type AnalyticsView
} from '$lib/views/analytics';
import type { AnalyticsItem, TrafficDay } from '$lib/types';

// Saturday, so 06-20 and 06-21 share the Monday 06-15 week
const NOW = new Date('2026-06-22T12:00:00Z');

const day = (
	repo: string,
	date: string,
	views: number,
	uniqueViews: number,
	clones = 0
): TrafficDay => ({
	repo,
	day: date,
	views,
	uniqueViews,
	clones,
	uniqueClones: clones
});

const view = (overrides: Partial<AnalyticsView> = {}): AnalyticsView => ({
	...defaultAnalyticsView(),
	windowKey: 'all',
	...overrides
});

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const sample: TrafficDay[] = [
	day('me/a', '2026-06-20', 10, 6, 2),
	day('me/b', '2026-06-20', 5, 5, 0),
	day('me/a', '2026-06-21', 4, 4, 1)
];

describe('aggregate', () => {
	it('sums repos per day and derives returning visits', () => {
		const points = aggregate(sample, view({ granularity: 'day' }));
		expect(points).toEqual([
			{ date: '2026-06-20', views: 15, uniqueViews: 11, returning: 4, clones: 2, uniqueClones: 2 },
			{ date: '2026-06-21', views: 4, uniqueViews: 4, returning: 0, clones: 1, uniqueClones: 1 }
		]);
	});

	it('buckets days into their Monday-first week', () => {
		const points = aggregate(sample, view({ granularity: 'week' }));
		expect(points).toHaveLength(1);
		expect(points[0]).toMatchObject({
			date: '2026-06-15',
			views: 19,
			uniqueViews: 15,
			returning: 4
		});
	});

	it('buckets days into their month', () => {
		const points = aggregate(sample, view({ granularity: 'month' }));
		expect(points).toEqual([
			{ date: '2026-06-01', views: 19, uniqueViews: 15, returning: 4, clones: 3, uniqueClones: 3 }
		]);
	});

	it('filters to a single repo', () => {
		const points = aggregate(sample, view({ repo: 'me/a', granularity: 'day' }));
		expect(points.map((point) => point.views)).toEqual([10, 4]);
	});

	it('drops rows outside the window', () => {
		const old = [...sample, day('me/a', '2026-01-01', 999, 999)];
		const points = aggregate(old, view({ windowKey: '30', granularity: 'month' }));
		expect(points.every((point) => point.date >= '2026-06-01')).toBe(true);
	});
});

describe('totals', () => {
	it('compares the window against the preceding one', () => {
		const rows = [...sample, day('me/a', '2026-05-01', 100, 80)];
		const result = totals(rows, view({ windowKey: '30' }));
		const views = result.find((metric) => metric.key === 'views');
		expect(views).toMatchObject({ value: 19, delta: 19 - 100 });
	});

	it('omits the delta when the previous period had no data', () => {
		const views = totals(sample, view({ windowKey: 'all' })).find((m) => m.key === 'views');
		expect(views?.value).toBe(19);
		expect(views?.delta).toBeUndefined();
	});
});

const items: AnalyticsItem[] = [
	{ repo: 'me/a', label: 'Home', sublabel: '/me/a', count: 30, uniques: 20 },
	{ repo: 'me/b', label: 'Home', sublabel: '/me/b', count: 10, uniques: 8 },
	{ repo: 'me/a', label: 'Docs', sublabel: '/me/a/docs', count: 5, uniques: 4 }
];

describe('top lists', () => {
	it('keeps pages per repo, prefixing the repo when combined', () => {
		const rows = topPaths(items, '');
		expect(rows[0]).toMatchObject({ label: 'a/me/a', value: 30 });
		expect(rows).toHaveLength(3);
	});

	it('sums referrers of the same name across repos', () => {
		const referrers: AnalyticsItem[] = [
			{ repo: 'me/a', label: 'google.com', count: 12, uniques: 9 },
			{ repo: 'me/b', label: 'google.com', count: 8, uniques: 6 },
			{ repo: 'me/a', label: 'github.com', count: 4, uniques: 3 }
		];
		const rows = topReferrers(referrers, '');
		expect(rows[0]).toMatchObject({ label: 'google.com', value: 20 });
		expect(rows[0].icon).toBe('https://icon.horse/icon/google.com');
		expect(rows).toHaveLength(2);
	});
});

describe('viewsByRepo', () => {
	it('ranks repos by views in the window', () => {
		const rows = viewsByRepo(sample, view({ granularity: 'day' }));
		expect(rows.map((row) => [row.label, row.value])).toEqual([
			['a', 14],
			['b', 5]
		]);
	});
});

describe('scopeLabel', () => {
	it('names the window, adding the repo once one is picked', () => {
		expect(scopeLabel(view({ windowKey: '30' }))).toBe('Last 30 days');
		expect(scopeLabel(view({ windowKey: '30', repo: 'me/a' }))).toBe('Last 30 days · a');
	});

	it('takes an override range for the panels GitHub only snapshots', () => {
		expect(scopeLabel(view({ windowKey: '90', repo: 'me/a' }), SNAPSHOT_RANGE)).toBe(
			'Last 14 days · a'
		);
	});
});

describe('deltaHint', () => {
	it('names the window the delta compares against', () => {
		expect(deltaHint(view({ windowKey: '90' }))).toBe('Last 90 days vs previous 90 days');
	});

	it('has nothing to compare against over all time', () => {
		expect(deltaHint(view({ windowKey: 'all' }))).toBeUndefined();
	});
});

describe('fillGaps', () => {
	const days = (rows: TrafficDay[]) => rows.map((row) => [row.day, row.views, row.clones]);

	it('bridges a short gap with straight-line estimates', () => {
		const rows = fillGaps([
			day('me/a', '2026-09-03', 100, 50, 10),
			day('me/a', '2026-09-06', 400, 80, 40)
		]);
		expect(days(rows)).toEqual([
			['2026-09-03', 100, 10],
			['2026-09-04', 200, 20],
			['2026-09-05', 300, 30],
			['2026-09-06', 400, 40]
		]);
	});

	it('leaves gaps longer than the limit visibly missing', () => {
		const rows = fillGaps([day('me/a', '2026-09-01', 10, 5), day('me/a', '2026-09-06', 20, 5)]);
		expect(rows).toHaveLength(2);
	});

	it('never bridges across repos and keeps real zero days as they are', () => {
		const rows = fillGaps([
			day('me/a', '2026-09-01', 10, 5),
			day('me/a', '2026-09-02', 0, 0),
			day('me/b', '2026-09-04', 30, 9)
		]);
		expect(rows.map((row) => [row.repo, row.day, row.views])).toEqual([
			['me/a', '2026-09-01', 10],
			['me/a', '2026-09-02', 0],
			['me/b', '2026-09-04', 30]
		]);
	});
});
