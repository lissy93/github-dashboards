import type { ChartData } from '$lib/views/analytics';
import type { StackBar, StackSeries } from '$lib/views/stats';
import type { RepoStarHistory } from '$lib/server/github/star-history';
import type { Granularity, TimelinePoint } from '$lib/server/github/repo-timeline';

// Issue and PR timeline metrics, coloured from the shared chart tokens. The open
// counts are the running backlog, the opened/closed counts are per-period flow
export const TIMELINE_METRICS = [
	{
		key: 'openIssues',
		label: 'Open issues',
		color: 'var(--chart-1)',
		hint: 'Issues still open at each point, the running backlog'
	},
	{
		key: 'openedIssues',
		label: 'Issues opened',
		color: 'var(--chart-5)',
		hint: 'New issues opened in each period'
	},
	{
		key: 'closedIssues',
		label: 'Issues closed',
		color: 'var(--chart-3)',
		hint: 'Issues closed in each period'
	},
	{
		key: 'openPrs',
		label: 'Open PRs',
		color: 'var(--chart-2)',
		hint: 'Pull requests still open at each point, the running backlog'
	},
	{
		key: 'openedPrs',
		label: 'PRs opened',
		color: 'var(--muted-foreground)',
		hint: 'New pull requests opened in each period'
	},
	{
		key: 'closedPrs',
		label: 'PRs closed',
		color: 'var(--chart-4)',
		hint: 'Pull requests closed or merged in each period'
	}
] as const;

export type TimelineMetricKey = (typeof TIMELINE_METRICS)[number]['key'];

// Time windows for the timeline chart, all-time spans the repo's whole history
export const TIMELINE_WINDOWS = [
	{ key: 'all', label: 'All time', months: Infinity },
	{ key: '12', label: 'Last year', months: 12 },
	{ key: '24', label: 'Last 2 years', months: 24 },
	{ key: '60', label: 'Last 5 years', months: 60 }
];

export type TimelineView = {
	metrics: TimelineMetricKey[];
	windowKey: string;
	area: boolean;
	cumulative: boolean;
};

export function defaultTimelineView(): TimelineView {
	return { metrics: ['openIssues', 'openPrs'], windowKey: 'all', area: false, cumulative: false };
}

// Start of the chosen window as a bucket date, empty for the unbounded all-time view
function windowStart(windowKey: string): string {
	const months = TIMELINE_WINDOWS.find((window) => window.key === windowKey)?.months ?? Infinity;
	if (!Number.isFinite(months)) return '';
	const cutoff = new Date();
	cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
	return cutoff.toISOString().slice(0, 10);
}

// Keep only points within the chosen window, measured from now so weekly and monthly
// data both filter by real time rather than a raw point count
export function pointsInWindow(points: TimelinePoint[], windowKey: string): TimelinePoint[] {
	const since = windowStart(windowKey);
	return since ? points.filter((point) => point.period >= since) : points;
}

// The flow metrics that turn into running totals in cumulative mode
const FLOW_KEYS = new Set(['openedIssues', 'closedIssues', 'openedPrs', 'closedPrs']);

export type TimelineChartOptions = { cumulative?: boolean; windowKey?: string };

// Shape timeline points into the selected metric series. In cumulative mode the flow
// metrics accumulate across the full history before the window is applied, so a windowed
// view still starts from the real running total rather than zero
export function timelineChart(
	points: TimelinePoint[],
	keys: TimelineMetricKey[],
	options: TimelineChartOptions = {}
): ChartData {
	const { cumulative = false, windowKey = 'all' } = options;
	const since = windowStart(windowKey);
	const defs = TIMELINE_METRICS.filter((metric) => keys.includes(metric.key));
	const sums = new Map<string, number>(defs.map((def) => [def.key, 0]));

	const dates: string[] = [];
	const columns = defs.map(() => [] as number[]);
	for (const point of points) {
		const visible = !since || point.period >= since;
		if (visible) dates.push(point.period);
		defs.forEach((def, index) => {
			let value = point[def.key];
			if (cumulative && FLOW_KEYS.has(def.key)) {
				value = (sums.get(def.key) ?? 0) + point[def.key];
				sums.set(def.key, value);
			}
			if (visible) columns[index].push(value);
		});
	}

	const series = defs.map((def, index) => ({
		key: def.key,
		label: def.label,
		color: def.color,
		values: columns[index]
	}));
	const max = Math.max(1, ...columns.flat());
	return { dates, series, max };
}

export const CUMULATIVE_SERIES: StackSeries[] = [
	{ key: 'closed', label: 'Closed', color: 'var(--chart-3)' },
	{ key: 'open', label: 'Open', color: 'var(--chart-1)' }
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Compact bar label from a bucket-start date: month and year, or day and month for weeks
function bucketLabel(period: string, granularity: Granularity): string {
	const [year, monthNum, day] = period.split('-').map(Number);
	if (granularity === 'week') return `${day} ${MONTHS[monthNum - 1]}`;
	return `${MONTHS[monthNum - 1]} ${String(year).slice(2)}`;
}

// Total issues or PRs ever opened per bucket, split into the count still open versus
// closed at that bucket. Monthly or weekly to match the timeline's own granularity
export function cumulativeBars(
	points: TimelinePoint[],
	kind: 'issue' | 'pr',
	granularity: Granularity
): StackBar[] {
	const openedKey = kind === 'issue' ? 'openedIssues' : 'openedPrs';
	const openKey = kind === 'issue' ? 'openIssues' : 'openPrs';

	let opened = 0;
	return points.map((point) => {
		opened += point[openedKey];
		const open = point[openKey];
		return {
			label: bucketLabel(point.period, granularity),
			values: { open, closed: Math.max(0, opened - open) },
			total: opened
		};
	});
}

// Sparse x-axis labels parallel to the cumulative bars: the year at each year change
// for monthly data, the month at each month change for weekly data, blank elsewhere
export function cumulativeTicks(points: TimelinePoint[], granularity: Granularity): string[] {
	let prevYear = '';
	let prevMonth = '';
	return points.map((point) => {
		const [year, month] = point.period.split('-');
		if (granularity === 'week') {
			const changed = month !== prevMonth || year !== prevYear;
			prevYear = year;
			prevMonth = month;
			return changed ? MONTHS[Number(month) - 1] : '';
		}
		if (year !== prevYear) {
			prevYear = year;
			return year;
		}
		return '';
	});
}

// One star-count series for the time chart
export function starChart(history: RepoStarHistory): ChartData {
	return {
		dates: history.days,
		series: [{ key: 'stars', label: 'Stars', color: 'var(--chart-1)', values: history.stars }],
		max: Math.max(1, ...history.stars)
	};
}

// Human label for a GitHub Actions run conclusion or status
export function runState(
	status: string | null,
	conclusion: string | null
): { label: string; token: 'success' | 'danger' | 'warning' | 'muted' } {
	if (status && status !== 'completed') return { label: 'Running', token: 'warning' };
	if (conclusion === 'success') return { label: 'Passing', token: 'success' };
	if (conclusion === 'failure' || conclusion === 'timed_out')
		return { label: 'Failing', token: 'danger' };
	if (conclusion === 'cancelled' || conclusion === 'skipped')
		return { label: 'Skipped', token: 'muted' };
	if (!conclusion) return { label: 'No runs', token: 'muted' };
	return { label: conclusion, token: 'muted' };
}

// Compact mm:ss style duration from seconds, for workflow runtimes
export function formatDuration(seconds: number | null): string {
	if (seconds == null) return '-';
	if (seconds < 60) return `${Math.round(seconds)}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
