import { MONTHS_SHORT } from '$lib/utils/datetime';
import type { ChartData } from '$lib/views/analytics';
import { outcomeBars, type OutcomeChart } from '$lib/utils/outcomes';
import type { Slice, StackBar, StackSeries } from '$lib/types/charts';
import type { RepoRunActivity, RepoWorkflows } from '$lib/types';
import type { RepoStarHistory } from '$lib/types';
import type { ResolutionStats, TimelineBaseline, TimelinePoint } from '$lib/types';

// Issues vs PRs, the chart mode, and the bar grouping for the flow timeline
export type FlowScope = 'issues' | 'prs' | 'both';
export type FlowMode = 'flow' | 'lifecycle' | 'velocity' | 'resolution' | 'heatmap';
export type GroupUnit = 'week' | 'month' | 'quarter' | 'year';
export type GroupChoice = 'auto' | GroupUnit;

// A point field that holds a count, the raw fields a flow series reads
type FlowField = Exclude<keyof TimelinePoint, 'period' | 'resolveIssuesHours' | 'resolvePrsHours'>;

// One flow series: opened bars rise, closed bars drop, the open backlog is a line.
// Net velocity uses its own computed keys, so the key is a plain string
export type FlowSeriesDef = {
	key: string;
	label: string;
	color: string;
	hint: string;
	axis: 'up' | 'down' | 'line';
	dash?: boolean;
};

// Issues and PRs each keep a hue, opened bright and closed a muted shade of it. Shared
// by the both-scope flow bars and the activity heatmap so the colours mean one thing
const KIND_COLOR = {
	issueOpen: 'var(--chart-1)',
	issueClosed: 'color-mix(in oklch, var(--chart-1) 50%, var(--card))',
	prOpen: 'var(--chart-2)',
	prClosed: 'color-mix(in oklch, var(--chart-2) 50%, var(--card))'
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
				color: KIND_COLOR.issueClosed,
				hint: 'Issues closed in each period',
				axis: 'down'
			},
			{
				key: 'closedPrs',
				label: 'PRs closed',
				color: KIND_COLOR.prClosed,
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
		for (const series of fields) values[series.key] = point[series.key as FlowField];
		return { period: point.period, label: bucketLabel(point.period, group), values };
	});
	return { bars, up, down, lines: shownLines, ticks: cumulativeTicks(grouped, group), group };
}

// Opened and closed counts for a scope, issues plus PRs when both are shown
function scopeOpened(point: TimelinePoint, scope: FlowScope): number {
	if (scope === 'issues') return point.openedIssues;
	if (scope === 'prs') return point.openedPrs;
	return point.openedIssues + point.openedPrs;
}
function scopeClosed(point: TimelinePoint, scope: FlowScope): number {
	if (scope === 'issues') return point.closedIssues;
	if (scope === 'prs') return point.closedPrs;
	return point.closedIssues + point.closedPrs;
}

// Net velocity bars: closed minus opened, so a positive bar means the backlog shrank.
// Rendered through the flow chart, with one signed bar and the same backlog line
const NET_SERIES = {
	up: {
		key: 'win',
		label: 'Net closed',
		color: 'var(--success)',
		hint: 'Closed more than opened, the backlog shrank',
		axis: 'up' as const
	},
	down: {
		key: 'loss',
		label: 'Net opened',
		color: 'var(--danger)',
		hint: 'Opened more than closed, the backlog grew',
		axis: 'down' as const
	}
};

export function netVelocityChart(
	points: TimelinePoint[],
	view: TimelineView,
	base: GroupUnit
): FlowChart {
	const windowed = pointsInWindow(points, view.windowKey);
	const group = resolveGroup(windowed, view.group, base);
	const grouped = groupPoints(windowed, group);
	const lines = view.backlog ? FLOW_SERIES[view.scope].lines : [];
	const bars = grouped.map((point) => {
		const net = scopeClosed(point, view.scope) - scopeOpened(point, view.scope);
		const values: Record<string, number> = { win: Math.max(0, net), loss: Math.max(0, -net) };
		for (const series of lines) values[series.key] = point[series.key as FlowField];
		return { period: point.period, label: bucketLabel(point.period, group), values };
	});
	return {
		bars,
		up: [NET_SERIES.up],
		down: [NET_SERIES.down],
		lines,
		ticks: cumulativeTicks(grouped, group),
		group
	};
}

// Carry the last known value across gaps so a sparse trend stays a continuous line,
// back-filling the lead-in with the first reading. Null when nothing was ever resolved
function carryForward(values: (number | null)[]): number[] | null {
	const first = values.findIndex((value) => value !== null);
	if (first === -1) return null;
	let last = values[first]!;
	return values.map((value, index) => {
		if (value !== null) last = value;
		return index < first ? values[first]! : last;
	});
}

// Median time-to-resolve over time, in days, as a line per shown kind. Per-group values
// are a count-weighted blend of each bucket's median, an approximation past the base unit
export function resolutionTrendChart(
	points: TimelinePoint[],
	view: TimelineView,
	base: GroupUnit
): ChartData {
	const windowed = pointsInWindow(points, view.windowKey);
	const group = resolveGroup(windowed, view.group, base);
	const order: string[] = [];
	const groups = new Map<
		string,
		{ period: string; issueSum: number; issueWeight: number; prSum: number; prWeight: number }
	>();
	for (const point of windowed) {
		const groupKey = groupKeyOf(point.period, group);
		let bucket = groups.get(groupKey);
		if (!bucket) {
			bucket = { period: point.period, issueSum: 0, issueWeight: 0, prSum: 0, prWeight: 0 };
			groups.set(groupKey, bucket);
			order.push(groupKey);
		}
		if (point.resolveIssuesHours !== null) {
			bucket.issueSum += point.resolveIssuesHours * point.completedIssues;
			bucket.issueWeight += point.completedIssues;
		}
		if (point.resolvePrsHours !== null) {
			bucket.prSum += point.resolvePrsHours * point.mergedPrs;
			bucket.prWeight += point.mergedPrs;
		}
	}
	const buckets = order.map((groupKey) => groups.get(groupKey)!);
	const dates = buckets.map((bucket) => bucket.period);
	const toDays = (sum: number, weight: number) => (weight ? sum / weight / 24 : null);

	const candidates = [
		{
			key: 'issues',
			label: 'Issues',
			color: 'var(--chart-1)',
			hint: 'Median days to close an issue',
			scope: 'issues'
		},
		{
			key: 'prs',
			label: 'PRs',
			color: 'var(--chart-2)',
			hint: 'Median days to merge a PR',
			scope: 'prs'
		}
	];
	const series = candidates
		.filter((candidate) => view.scope === 'both' || view.scope === candidate.scope)
		.map((candidate) => ({
			...candidate,
			values: carryForward(
				buckets.map((bucket) =>
					candidate.key === 'issues'
						? toDays(bucket.issueSum, bucket.issueWeight)
						: toDays(bucket.prSum, bucket.prWeight)
				)
			)
		}))
		.filter((entry): entry is typeof entry & { values: number[] } => entry.values !== null);

	const max = Math.max(1, ...series.flatMap((entry) => entry.values));
	return { dates: series.length ? dates : [], series, max };
}

// One readout line in a cell: the kind sets the icon, the role sets the colour. A both
// scope shows a line per kind (role total), a single scope splits into opened and closed
export type HeatmapLine = {
	kind: 'issue' | 'pr';
	role: 'opened' | 'closed' | 'total';
	value: number;
};
export type HeatmapCell = { total: number; opened: number; closed: number; lines: HeatmapLine[] };
export type HeatmapData = { rows: { year: number; cells: HeatmapCell[] }[]; max: number };

type RawCell = { issueOpen: number; issueClosed: number; prOpen: number; prClosed: number };
const emptyCell = (): RawCell => ({ issueOpen: 0, issueClosed: 0, prOpen: 0, prClosed: 0 });

// Turn a month's raw counts into the readout lines and opened/closed split for a scope
function heatmapCell(raw: RawCell, scope: FlowScope): HeatmapCell {
	const issueTotal = raw.issueOpen + raw.issueClosed;
	const prTotal = raw.prOpen + raw.prClosed;
	if (scope === 'issues')
		return {
			total: issueTotal,
			opened: raw.issueOpen,
			closed: raw.issueClosed,
			lines: [
				{ kind: 'issue', role: 'opened', value: raw.issueOpen },
				{ kind: 'issue', role: 'closed', value: raw.issueClosed }
			]
		};
	if (scope === 'prs')
		return {
			total: prTotal,
			opened: raw.prOpen,
			closed: raw.prClosed,
			lines: [
				{ kind: 'pr', role: 'opened', value: raw.prOpen },
				{ kind: 'pr', role: 'closed', value: raw.prClosed }
			]
		};
	return {
		total: issueTotal + prTotal,
		opened: raw.issueOpen + raw.prOpen,
		closed: raw.issueClosed + raw.prClosed,
		lines: [
			{ kind: 'issue', role: 'total', value: issueTotal },
			{ kind: 'pr', role: 'total', value: prTotal }
		]
	};
}

// Activity per calendar month, split by kind and open/close state, as a year-by-month
// grid for spotting seasonal rhythm. Window filters the years, grouping is ignored
export function activityHeatmap(points: TimelinePoint[], view: TimelineView): HeatmapData {
	const windowed = pointsInWindow(points, view.windowKey);
	if (!windowed.length) return { rows: [], max: 0 };
	const byYear = new Map<number, RawCell[]>();
	for (const point of windowed) {
		const [year, month] = point.period.split('-').map(Number);
		if (!byYear.has(year)) byYear.set(year, Array.from({ length: 12 }, emptyCell));
		const cell = byYear.get(year)![month - 1];
		cell.issueOpen += point.openedIssues;
		cell.issueClosed += point.closedIssues;
		cell.prOpen += point.openedPrs;
		cell.prClosed += point.closedPrs;
	}
	const years = [...byYear.keys()];
	const rows = [];
	for (let year = Math.min(...years); year <= Math.max(...years); year += 1) {
		const raw = byYear.get(year) ?? Array.from({ length: 12 }, emptyCell);
		rows.push({ year, cells: raw.map((cell) => heatmapCell(cell, view.scope)) });
	}
	const max = Math.max(0, ...rows.flatMap((row) => row.cells.map((cell) => cell.total)));
	return { rows, max };
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
const ISSUE_LIFECYCLE_SERIES: StackSeries[] = [
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
const PR_LIFECYCLE_SERIES: StackSeries[] = [
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

// Compact bar label from a bucket-start date, in the grouping unit's own terms
function bucketLabel(period: string, unit: GroupUnit): string {
	const [year, monthNum, day] = period.split('-').map(Number);
	const yy = String(year).slice(2);
	if (unit === 'week') return `${day} ${MONTHS_SHORT[monthNum - 1]}`;
	if (unit === 'quarter') return `Q${Math.floor((monthNum - 1) / 3) + 1} ${yy}`;
	if (unit === 'year') return String(year);
	return `${MONTHS_SHORT[monthNum - 1]} ${yy}`;
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
			return changed ? MONTHS_SHORT[Number(month) - 1] : '';
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

// Severity ramp for the resolution bands, fast and healthy green through slow red
const RESOLUTION_COLORS = [
	'var(--success)', // < 1h
	'var(--success)', // < 1d
	'var(--success)', // < 1w
	'var(--warning)', // < 1mo
	'var(--caution)', // < 6mo
	'var(--danger)' // 6mo+
];

// Resolution histogram bands as bars, coloured by how slow each band is.
// Pass open to append a grey backlog bar for items that are still open
export function resolutionBars(stats: ResolutionStats, open?: number): Slice[] {
	const bars: Slice[] = stats.buckets.map((bucket, index) => ({
		label: bucket.label,
		value: bucket.count,
		color: RESOLUTION_COLORS[index] ?? 'var(--muted-foreground)'
	}));
	if (open != null) {
		bars.push({ label: 'Still open', value: open, color: 'var(--muted-foreground)' });
	}
	return bars;
}
