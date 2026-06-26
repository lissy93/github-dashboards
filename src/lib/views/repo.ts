import type { ChartData } from '$lib/views/analytics';
import { outcomeBars, type OutcomeChart } from '$lib/views/outcomes';
import type { Slice, StackBar, StackSeries } from '$lib/views/stats';
import type { RepoRunActivity, RepoWorkflows } from '$lib/server/github/workflows';
import type { RepoStarHistory } from '$lib/server/github/star-history';
import type {
	ResolutionStats,
	TimelineBaseline,
	TimelinePoint
} from '$lib/server/github/repo-timeline';

// Issues vs PRs, the chart mode, and the bar grouping for the flow timeline
export type FlowScope = 'issues' | 'prs' | 'both';
export type FlowMode = 'flow' | 'lifecycle';
export type GroupUnit = 'week' | 'month' | 'quarter' | 'year';
export type GroupChoice = 'auto' | GroupUnit;

// A point field that holds a count, the only fields a flow series can read
type FlowField = keyof Omit<TimelinePoint, 'period'>;

// One flow series: opened bars rise, closed bars drop, the open backlog is a line
export type FlowSeriesDef = {
	key: FlowField;
	label: string;
	color: string;
	hint: string;
	axis: 'up' | 'down' | 'line';
	dash?: boolean;
};

// Bars and backlog lines per scope, coloured from the shared chart and lifecycle tokens
const FLOW_SERIES: Record<
	FlowScope,
	{ up: FlowSeriesDef[]; down: FlowSeriesDef[]; lines: FlowSeriesDef[] }
> = {
	issues: {
		up: [
			{
				key: 'openedIssues',
				label: 'Opened',
				color: 'var(--chart-1)',
				hint: 'New issues opened in each period',
				axis: 'up'
			}
		],
		down: [
			{
				key: 'completedIssues',
				label: 'Completed',
				color: 'var(--lifecycle-resolved)',
				hint: 'Issues closed as done',
				axis: 'down'
			},
			{
				key: 'discardedIssues',
				label: 'Not planned',
				color: 'var(--lifecycle-discarded)',
				hint: 'Issues closed as not planned or duplicate',
				axis: 'down'
			}
		],
		lines: [
			{
				key: 'openIssues',
				label: 'Open backlog',
				color: 'var(--chart-1)',
				hint: 'Issues still open at each point',
				axis: 'line',
				dash: true
			}
		]
	},
	prs: {
		up: [
			{
				key: 'openedPrs',
				label: 'Opened',
				color: 'var(--chart-2)',
				hint: 'New pull requests opened in each period',
				axis: 'up'
			}
		],
		down: [
			{
				key: 'mergedPrs',
				label: 'Merged',
				color: 'var(--lifecycle-resolved)',
				hint: 'Pull requests merged in',
				axis: 'down'
			},
			{
				key: 'discardedPrs',
				label: 'Closed',
				color: 'var(--lifecycle-discarded)',
				hint: 'Pull requests closed without merging',
				axis: 'down'
			}
		],
		lines: [
			{
				key: 'openPrs',
				label: 'Open backlog',
				color: 'var(--chart-2)',
				hint: 'Pull requests still open at each point',
				axis: 'line',
				dash: true
			}
		]
	},
	both: {
		up: [
			{
				key: 'openedIssues',
				label: 'Issues opened',
				color: 'var(--chart-1)',
				hint: 'New issues opened in each period',
				axis: 'up'
			},
			{
				key: 'openedPrs',
				label: 'PRs opened',
				color: 'var(--chart-2)',
				hint: 'New pull requests opened in each period',
				axis: 'up'
			}
		],
		down: [
			{
				key: 'closedIssues',
				label: 'Issues closed',
				color: 'color-mix(in oklch, var(--chart-1) 50%, var(--card))',
				hint: 'Issues closed in each period',
				axis: 'down'
			},
			{
				key: 'closedPrs',
				label: 'PRs closed',
				color: 'color-mix(in oklch, var(--chart-2) 50%, var(--card))',
				hint: 'Pull requests closed or merged in each period',
				axis: 'down'
			}
		],
		lines: [
			{
				key: 'openIssues',
				label: 'Issue backlog',
				color: 'var(--chart-1)',
				hint: 'Issues still open at each point',
				axis: 'line',
				dash: true
			},
			{
				key: 'openPrs',
				label: 'PR backlog',
				color: 'var(--chart-2)',
				hint: 'Pull requests still open at each point',
				axis: 'line',
				dash: true
			}
		]
	}
};

// Time windows for the timeline chart, all-time spans the repo's whole history
export const TIMELINE_WINDOWS = [
	{ key: 'all', label: 'All time', months: Infinity },
	{ key: '12', label: 'Last year', months: 12 },
	{ key: '24', label: 'Last 2 years', months: 24 },
	{ key: '60', label: 'Last 5 years', months: 60 }
];

export type TimelineView = {
	mode: FlowMode;
	scope: FlowScope;
	windowKey: string;
	group: GroupChoice;
	backlog: boolean;
};

export function defaultTimelineView(): TimelineView {
	return { mode: 'flow', scope: 'both', windowKey: 'all', group: 'auto', backlog: true };
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

// Flow counts sum across a group, the open backlog snapshots the period's last value
const FLOW_FIELDS: FlowField[] = [
	'openedIssues',
	'closedIssues',
	'completedIssues',
	'discardedIssues',
	'openedPrs',
	'closedPrs',
	'mergedPrs',
	'discardedPrs'
];
// Roughly the most bars that stay readable before auto coarsens the grouping
const TARGET_BARS = 64;

// Coarser units a base granularity can roll up into, finest first
export function groupUnitsFor(base: GroupUnit): GroupUnit[] {
	return base === 'week' ? ['week', 'month', 'quarter'] : ['month', 'quarter', 'year'];
}

// The bucket key a period falls in for a grouping unit
function groupKeyOf(period: string, unit: GroupUnit): string {
	const [year, month] = period.split('-');
	if (unit === 'year') return year;
	if (unit === 'quarter') return `${year}-Q${Math.floor((Number(month) - 1) / 3) + 1}`;
	if (unit === 'month') return `${year}-${month}`;
	return period;
}

// Auto picks the finest unit that stays under the bar target, else honours the choice
export function resolveGroup(
	points: TimelinePoint[],
	choice: GroupChoice,
	base: GroupUnit
): GroupUnit {
	if (choice !== 'auto') return choice;
	const units = groupUnitsFor(base);
	for (const unit of units) {
		const count = new Set(points.map((point) => groupKeyOf(point.period, unit))).size;
		if (count <= TARGET_BARS) return unit;
	}
	return units[units.length - 1];
}

// Roll points up into a coarser unit, summing flow and keeping the latest backlog
export function groupPoints(points: TimelinePoint[], unit: GroupUnit): TimelinePoint[] {
	const order: string[] = [];
	const groups = new Map<string, TimelinePoint[]>();
	for (const point of points) {
		const groupKey = groupKeyOf(point.period, unit);
		if (!groups.has(groupKey)) {
			groups.set(groupKey, []);
			order.push(groupKey);
		}
		groups.get(groupKey)!.push(point);
	}
	return order.map((groupKey) => {
		const members = groups.get(groupKey)!;
		const rolled = { ...members[members.length - 1], period: members[0].period };
		for (const field of FLOW_FIELDS) {
			rolled[field] = members.reduce((sum, point) => sum + point[field], 0);
		}
		return rolled;
	});
}

export type FlowChart = {
	bars: { period: string; label: string; values: Record<string, number> }[];
	up: FlowSeriesDef[];
	down: FlowSeriesDef[];
	lines: FlowSeriesDef[];
	ticks: string[];
	group: GroupUnit;
};

// Shape timeline points into the flow chart: opened and closed bars plus the backlog
// line, windowed then grouped so a long history stays to a readable handful of bars
export function flowChart(points: TimelinePoint[], view: TimelineView, base: GroupUnit): FlowChart {
	const windowed = pointsInWindow(points, view.windowKey);
	const group = resolveGroup(windowed, view.group, base);
	const grouped = groupPoints(windowed, group);
	const { up, down, lines } = FLOW_SERIES[view.scope];
	const shownLines = view.backlog ? lines : [];
	const fields = [...up, ...down, ...shownLines];
	const bars = grouped.map((point) => {
		const values: Record<string, number> = {};
		for (const series of fields) values[series.key] = point[series.key];
		return { period: point.period, label: bucketLabel(point.period, group), values };
	});
	return { bars, up, down, lines: shownLines, ticks: cumulativeTicks(grouped, group), group };
}

// Stacked lifecycle bars for one kind, windowed and grouped to match the flow chart
export function lifecycleView(
	points: TimelinePoint[],
	view: TimelineView,
	base: GroupUnit,
	baseline: TimelineBaseline,
	kind: 'issue' | 'pr'
): { bars: StackBar[]; series: StackSeries[]; ticks: string[] } {
	const windowed = pointsInWindow(points, view.windowKey);
	const group = resolveGroup(windowed, view.group, base);
	const grouped = groupPoints(windowed, group);
	return {
		bars: lifecycleBars(grouped, kind, group, baseline),
		series: lifecycleSeries(kind),
		ticks: cumulativeTicks(grouped, group)
	};
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

// Compact bar label from a bucket-start date, in the grouping unit's own terms
function bucketLabel(period: string, unit: GroupUnit): string {
	const [year, monthNum, day] = period.split('-').map(Number);
	const yy = String(year).slice(2);
	if (unit === 'week') return `${day} ${MONTHS[monthNum - 1]}`;
	if (unit === 'quarter') return `Q${Math.floor((monthNum - 1) / 3) + 1} ${yy}`;
	if (unit === 'year') return String(year);
	return `${MONTHS[monthNum - 1]} ${yy}`;
}

// Total issues or PRs ever opened per bucket, split into still open, resolved
// (merged/completed) and discarded (closed/not planned), accumulated to each bucket.
// Monthly or weekly to match the timeline's own granularity
export function lifecycleBars(
	points: TimelinePoint[],
	kind: 'issue' | 'pr',
	granularity: GroupUnit,
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

// Sparse x-axis labels parallel to the bars: the month at each month change for weekly
// data, the year for everything coarser, kept to one label per year, blank elsewhere
export function cumulativeTicks(points: TimelinePoint[], unit: GroupUnit): string[] {
	let prevYear = '';
	let prevMonth = '';
	return points.map((point) => {
		const [year, month] = point.period.split('-');
		if (unit === 'week') {
			const changed = month !== prevMonth || year !== prevYear;
			prevYear = year;
			prevMonth = month;
			return changed ? MONTHS[Number(month) - 1] : '';
		}
		if (unit === 'year') return year;
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
	retryRate: number | null;
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
	const retryRates = wf.workflows.map((w) => w.retryRate).filter((r): r is number => r != null);
	return {
		workflows: wf.totalWorkflows,
		passRate: decisive ? passed / decisive : null,
		totalRuns: wf.totalRuns,
		avgRuntimeSec: runtimeWeight ? Math.round(runtimeSum / runtimeWeight) : null,
		active,
		disabled,
		retryRate: retryRates.length
			? retryRates.reduce((sum, r) => sum + r, 0) / retryRates.length
			: null
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
