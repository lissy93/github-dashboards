import type { ChartData } from '$lib/views/analytics';
import { outcomeBars, type OutcomeChart } from '$lib/views/outcomes';
import type { Slice, StackBar, StackSeries } from '$lib/views/stats';
import type { RepoRunActivity, RepoWorkflows } from '$lib/server/github/workflows';
import type { RepoStarHistory } from '$lib/server/github/star-history';
import type {
	Granularity,
	ResolutionStats,
	TimelineBaseline,
	TimelinePoint
} from '$lib/server/github/repo-timeline';

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
		hint: def.hint,
		values: columns[index]
	}));
	const max = Math.max(1, ...columns.flat());
	return { dates, series, max };
}

// Lifecycle series for the cumulative total charts. Order is the stacking order from the
// baseline up: resolved at the bottom, the open backlog on top. Colours come from the
// --lifecycle-* tokens in layout.css, so the whole palette is tweakable in one place
export const ISSUE_LIFECYCLE_SERIES: StackSeries[] = [
	{
		key: 'earlier',
		label: 'Earlier history',
		color: 'var(--muted-foreground)',
		hint: 'Items created before the detailed history window'
	},
	{
		key: 'resolved',
		label: 'Completed',
		color: 'var(--lifecycle-resolved)',
		hint: 'Issues closed as done'
	},
	{
		key: 'discarded',
		label: 'Not planned',
		color: 'var(--lifecycle-discarded)',
		hint: 'Issues closed as not planned or duplicate'
	},
	{ key: 'open', label: 'Open', color: 'var(--lifecycle-open)', hint: 'Issues still open' }
];
export const PR_LIFECYCLE_SERIES: StackSeries[] = [
	{
		key: 'earlier',
		label: 'Earlier history',
		color: 'var(--muted-foreground)',
		hint: 'Items created before the detailed history window'
	},
	{
		key: 'resolved',
		label: 'Merged',
		color: 'var(--lifecycle-resolved)',
		hint: 'Pull requests merged in'
	},
	{
		key: 'discarded',
		label: 'Closed',
		color: 'var(--lifecycle-discarded)',
		hint: 'Pull requests closed without merging'
	},
	{ key: 'open', label: 'Open', color: 'var(--lifecycle-open)', hint: 'Pull requests still open' }
];

// The matching series for a kind, so a caller picks colours and labels in one call
export const lifecycleSeries = (kind: 'issue' | 'pr'): StackSeries[] =>
	kind === 'issue' ? ISSUE_LIFECYCLE_SERIES : PR_LIFECYCLE_SERIES;

export const TIMELINE_SAMPLED_NOTE =
	'Older items are grouped as Earlier history, with detailed states shown for recent items';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Compact bar label from a bucket-start date: month and year, or day and month for weeks
function bucketLabel(period: string, granularity: Granularity): string {
	const [year, monthNum, day] = period.split('-').map(Number);
	if (granularity === 'week') return `${day} ${MONTHS[monthNum - 1]}`;
	return `${MONTHS[monthNum - 1]} ${String(year).slice(2)}`;
}

// Total issues or PRs ever opened per bucket, split into still open, resolved
// (merged/completed) and discarded (closed/not planned), accumulated to each bucket.
// Monthly or weekly to match the timeline's own granularity
export function lifecycleBars(
	points: TimelinePoint[],
	kind: 'issue' | 'pr',
	granularity: Granularity,
	baseline: TimelineBaseline = { total: 0, open: 0 }
): StackBar[] {
	const resolvedKey = kind === 'issue' ? 'completedIssues' : 'mergedPrs';
	const discardedKey = kind === 'issue' ? 'discardedIssues' : 'discardedPrs';
	const openKey = kind === 'issue' ? 'openIssues' : 'openPrs';

	let resolved = 0;
	let discarded = 0;
	return points.map((point) => {
		resolved += point[resolvedKey];
		discarded += point[discardedKey];
		const open = Math.max(0, point[openKey] - baseline.open);
		return {
			label: bucketLabel(point.period, granularity),
			values: { earlier: baseline.total, resolved, discarded, open },
			total: baseline.total + resolved + discarded + open
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

// Headline figures for the workflows strip. Pass rate and runtime are weighted by the
// runs each workflow sampled, so busy workflows count for more than rarely-run ones
export type WorkflowKpis = {
	workflows: number;
	passRate: number | null;
	totalRuns: number | null;
	avgRuntimeSec: number | null;
	active: number;
	disabled: number;
};
export function workflowKpiStats(wf: RepoWorkflows): WorkflowKpis {
	let passed = 0;
	let decisive = 0;
	let runtimeSum = 0;
	let runtimeWeight = 0;
	let active = 0;
	let disabled = 0;
	for (const workflow of wf.workflows) {
		if (workflow.passRate != null && workflow.runsSampled) {
			passed += workflow.passRate * workflow.runsSampled;
			decisive += workflow.runsSampled;
		}
		if (workflow.avgRuntimeSec != null && workflow.runsSampled) {
			runtimeSum += workflow.avgRuntimeSec * workflow.runsSampled;
			runtimeWeight += workflow.runsSampled;
		}
		if (workflow.state.startsWith('disabled')) disabled += 1;
		else active += 1;
	}
	return {
		workflows: wf.totalWorkflows,
		passRate: decisive ? passed / decisive : null,
		totalRuns: wf.totalRuns,
		avgRuntimeSec: runtimeWeight ? Math.round(runtimeSum / runtimeWeight) : null,
		active,
		disabled
	};
}

// Repo-wide run outcomes as a stacked timeline
export function runActivityChart(activity: RepoRunActivity): OutcomeChart {
	return outcomeBars(activity.buckets);
}

// Compact mm:ss style duration from seconds, for workflow runtimes
export function formatDuration(seconds: number | null): string {
	if (seconds == null) return '-';
	if (seconds < 60) return `${Math.round(seconds)}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// A coarse human span for resolution medians, scaling from hours up through years
export function formatSpanHours(hours: number | null): string {
	if (hours == null) return '-';
	if (hours < 1) return '< 1h';
	if (hours < 24) return `${Math.round(hours)}h`;
	const days = hours / 24;
	if (days < 7) return `${Math.round(days)}d`;
	if (days < 30) return `${Math.round(days / 7)}w`;
	if (days < 365) return `${Math.round(days / 30)}mo`;
	return `${(days / 365).toFixed(1)}y`;
}

// Severity ramp for the resolution bands, fast and healthy green through slow red
const RESOLUTION_COLORS = [
	'var(--success)', // < 1h
	'var(--success)', // < 1d
	'var(--success)', // < 1w
	'var(--warning)', // < 1mo
	'var(--caution)', // < 6mo
	'var(--danger)' // 6mo+
];

// Resolution histogram bands as bars, coloured by how slow each band is
export function resolutionBars(stats: ResolutionStats): Slice[] {
	return stats.buckets.map((bucket, index) => ({
		label: bucket.label,
		value: bucket.count,
		color: RESOLUTION_COLORS[index] ?? 'var(--muted-foreground)'
	}));
}
