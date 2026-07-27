import { monthStartOf, weekStartOf } from '$lib/utils/datetime';
import { formatNumber } from '$lib/utils/format';
import { faviconUrl } from '$lib/utils/favicon';
import type { Slice } from '$lib/types/charts';
import type { AnalyticsItem, TrafficDay } from '$lib/types';

export type MetricKey = 'views' | 'uniqueViews' | 'returning' | 'clones' | 'uniqueClones';
export type Granularity = 'day' | 'week' | 'month';

// Metrics the charts and tiles can show, coloured from the shared chart tokens
export const ANALYTICS_METRICS: { key: MetricKey; label: string; color: string }[] = [
	{ key: 'views', label: 'Views', color: 'var(--chart-1)' },
	{ key: 'uniqueViews', label: 'Unique visitors', color: 'var(--chart-2)' },
	{ key: 'returning', label: 'Returning', color: 'var(--chart-4)' },
	{ key: 'clones', label: 'Clones', color: 'var(--chart-3)' },
	{ key: 'uniqueClones', label: 'Unique cloners', color: 'var(--chart-5)' }
];

// Time ranges, all-time spans whatever history we have cached
export const ANALYTICS_WINDOWS = [
	{ key: '14', label: 'Last 14 days', days: 14 },
	{ key: '30', label: 'Last 30 days', days: 30 },
	{ key: '90', label: 'Last 90 days', days: 90 },
	{ key: '365', label: 'Last year', days: 365 },
	{ key: 'all', label: 'All time', days: Infinity }
];

export const ANALYTICS_GRANULARITY: { key: Granularity; label: string }[] = [
	{ key: 'day', label: 'Daily' },
	{ key: 'week', label: 'Weekly' },
	{ key: 'month', label: 'Monthly' }
];

export type AnalyticsView = {
	windowKey: string;
	repo: string;
	granularity: Granularity;
	metrics: MetricKey[];
	area: boolean;
};

export function defaultAnalyticsView(): AnalyticsView {
	return {
		windowKey: '90',
		repo: '',
		granularity: 'day',
		metrics: ['views', 'uniqueViews', 'clones'],
		area: true
	};
}

export type PeriodPoint = {
	date: string;
	views: number;
	uniqueViews: number;
	returning: number;
	clones: number;
	uniqueClones: number;
};

const shortRepo = (repo: string) => repo.split('/')[1] ?? repo;

function windowDays(key: string): number {
	return ANALYTICS_WINDOWS.find((window) => window.key === key)?.days ?? Infinity;
}

// UTC day string `days` back from now, empty for an unbounded window
function cutoffDay(days: number): string {
	if (!Number.isFinite(days)) return '';
	return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

// Snap a day to the first day of its bucket, so rows group by period
function periodKey(day: string, granularity: Granularity): string {
	if (granularity === 'month') return monthStartOf(day);
	if (granularity === 'week') return weekStartOf(day);
	return day;
}

function inView(daily: TrafficDay[], view: AnalyticsView): TrafficDay[] {
	const cutoff = cutoffDay(windowDays(view.windowKey));
	return daily.filter(
		(row) => (!view.repo || row.repo === view.repo) && (!cutoff || row.day >= cutoff)
	);
}

// Sum repo-days into one point per period, combining all repos in view
export function aggregate(daily: TrafficDay[], view: AnalyticsView): PeriodPoint[] {
	const byPeriod = new Map<string, PeriodPoint>();
	for (const row of inView(daily, view)) {
		const date = periodKey(row.day, view.granularity);
		let point = byPeriod.get(date);
		if (!point) {
			point = { date, views: 0, uniqueViews: 0, returning: 0, clones: 0, uniqueClones: 0 };
			byPeriod.set(date, point);
		}
		point.views += row.views;
		point.uniqueViews += row.uniqueViews;
		point.clones += row.clones;
		point.uniqueClones += row.uniqueClones;
	}
	const points = [...byPeriod.values()].sort((first, second) =>
		first.date.localeCompare(second.date)
	);
	// Returning visits are the repeat views left once unique visitors are removed
	for (const point of points) point.returning = Math.max(0, point.views - point.uniqueViews);
	return points;
}

export type ChartSeries = {
	key: string;
	label: string;
	color: string;
	values: number[];
	hint?: string;
};
export type ChartData = { dates: string[]; series: ChartSeries[]; max: number };

// Shape aggregated points into the selected metric series for the time chart
export function chartData(points: PeriodPoint[], metrics: MetricKey[]): ChartData {
	const defs = ANALYTICS_METRICS.filter((metric) => metrics.includes(metric.key));
	const series = defs.map((def) => ({
		key: def.key,
		label: def.label,
		color: def.color,
		values: points.map((point) => point[def.key])
	}));
	const max = Math.max(1, ...series.flatMap((item) => item.values));
	return { dates: points.map((point) => point.date), series, max };
}

type Sums = Record<MetricKey, number>;
const emptySums = (): Sums => ({
	views: 0,
	uniqueViews: 0,
	returning: 0,
	clones: 0,
	uniqueClones: 0
});

function sumRange(daily: TrafficDay[], repo: string, from: string, to: string): Sums {
	const sums = emptySums();
	for (const row of daily) {
		if (repo && row.repo !== repo) continue;
		if (from && row.day < from) continue;
		if (to && row.day >= to) continue;
		sums.views += row.views;
		sums.uniqueViews += row.uniqueViews;
		sums.clones += row.clones;
		sums.uniqueClones += row.uniqueClones;
	}
	sums.returning = Math.max(0, sums.views - sums.uniqueViews);
	return sums;
}

export type MetricTotal = { key: MetricKey; label: string; value: number; delta?: number };

// Window totals per metric with the change against the preceding equal window.
// Delta is omitted when that window had no data yet, so we never show a false jump
export function totals(daily: TrafficDay[], view: AnalyticsView): MetricTotal[] {
	const days = windowDays(view.windowKey);
	const finite = Number.isFinite(days);
	const current = cutoffDay(days);
	const previous = cutoffDay(days * 2);
	const now = sumRange(daily, view.repo, current, '');
	const before = finite ? sumRange(daily, view.repo, previous, current) : emptySums();
	return ANALYTICS_METRICS.map((metric) => ({
		key: metric.key,
		label: metric.label,
		value: now[metric.key],
		delta: before[metric.key] > 0 ? now[metric.key] - before[metric.key] : undefined
	}));
}

// Top individual pages, each path belongs to one repo so they are never merged
export function topPaths(items: AnalyticsItem[], repo: string, limit = 10): Slice[] {
	const filtered = repo ? items.filter((item) => item.repo === repo) : items;
	return [...filtered]
		.sort((first, second) => second.count - first.count)
		.slice(0, limit)
		.map((item) => ({
			label: repo ? (item.sublabel ?? item.label) : `${shortRepo(item.repo)}${item.sublabel ?? ''}`,
			value: item.count,
			rows: [
				{ label: 'Repo', value: item.repo },
				{ label: 'Page', value: item.label },
				{ label: 'Views', value: formatNumber(item.count) },
				{ label: 'Unique', value: formatNumber(item.uniques) }
			]
		}));
}

// Top referrers, summed across repos since the same source feeds many repos
export function topReferrers(items: AnalyticsItem[], repo: string, limit = 10): Slice[] {
	const filtered = repo ? items.filter((item) => item.repo === repo) : items;
	const byName = new Map<string, { count: number; uniques: number }>();
	for (const item of filtered) {
		const entry = byName.get(item.label) ?? { count: 0, uniques: 0 };
		entry.count += item.count;
		entry.uniques += item.uniques;
		byName.set(item.label, entry);
	}
	return [...byName.entries()]
		.sort((first, second) => second[1].count - first[1].count)
		.slice(0, limit)
		.map(([label, value]) => ({
			label,
			value: value.count,
			icon: faviconUrl(label),
			rows: [
				{ label: 'Referrer', value: label },
				{ label: 'Views', value: formatNumber(value.count) },
				{ label: 'Unique', value: formatNumber(value.uniques) }
			]
		}));
}

// Which repos draw the most views in the current window, for the by-repo bars
export function viewsByRepo(daily: TrafficDay[], view: AnalyticsView, limit = 10): Slice[] {
	const cutoff = cutoffDay(windowDays(view.windowKey));
	const byRepo = new Map<string, { views: number; clones: number }>();
	for (const row of daily) {
		if (view.repo && row.repo !== view.repo) continue;
		if (cutoff && row.day < cutoff) continue;
		const entry = byRepo.get(row.repo) ?? { views: 0, clones: 0 };
		entry.views += row.views;
		entry.clones += row.clones;
		byRepo.set(row.repo, entry);
	}
	return [...byRepo.entries()]
		.sort((first, second) => second[1].views - first[1].views)
		.slice(0, limit)
		.map(([repo, value]) => ({
			label: shortRepo(repo),
			value: value.views,
			rows: [
				{ label: 'Repo', value: repo },
				{ label: 'Views', value: formatNumber(value.views) },
				{ label: 'Clones', value: formatNumber(value.clones) }
			]
		}));
}

export function repoOptions(repos: string[]): { value: string; label: string }[] {
	return repos.map((repo) => ({ value: repo, label: shortRepo(repo) }));
}
