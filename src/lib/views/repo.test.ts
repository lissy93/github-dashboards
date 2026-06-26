import { describe, it, expect } from 'vitest';
import {
	runState,
	formatDuration,
	lifecycleBars,
	cumulativeTicks,
	pointsInWindow,
	groupPoints,
	resolveGroup,
	groupUnitsFor,
	flowChart,
	defaultTimelineView
} from '$lib/views/repo';

const point = (over: Partial<Parameters<typeof groupPoints>[0][number]> = {}) => ({
	period: '2024-01-01',
	openedIssues: 0,
	closedIssues: 0,
	completedIssues: 0,
	discardedIssues: 0,
	openIssues: 0,
	openedPrs: 0,
	closedPrs: 0,
	mergedPrs: 0,
	discardedPrs: 0,
	openPrs: 0,
	...over
});

describe('runState', () => {
	it('maps completed conclusions to tokens', () => {
		expect(runState('completed', 'success')).toEqual({ label: 'Passing', token: 'success' });
		expect(runState('completed', 'failure')).toEqual({ label: 'Failing', token: 'danger' });
		expect(runState('completed', 'cancelled').token).toBe('muted');
	});

	it('flags an in-progress run as running', () => {
		expect(runState('in_progress', null)).toEqual({ label: 'Running', token: 'warning' });
	});

	it('handles a workflow with no runs', () => {
		expect(runState(null, null)).toEqual({ label: 'No runs', token: 'muted' });
	});
});

describe('formatDuration', () => {
	it('formats seconds, minutes and hours', () => {
		expect(formatDuration(45)).toBe('45s');
		expect(formatDuration(90)).toBe('1m 30s');
		expect(formatDuration(3700)).toBe('1h 1m');
	});

	it('shows a dash for a missing duration', () => {
		expect(formatDuration(null)).toBe('-');
	});
});

describe('groupUnitsFor', () => {
	it('offers coarser units from the base granularity up', () => {
		expect(groupUnitsFor('week')).toEqual(['week', 'month', 'quarter']);
		expect(groupUnitsFor('month')).toEqual(['month', 'quarter', 'year']);
	});
});

describe('groupPoints', () => {
	it('sums flow across a group and keeps the last running backlog', () => {
		const points = [
			point({ period: '2024-01-01', openedIssues: 2, completedIssues: 1, openIssues: 5 }),
			point({ period: '2024-02-01', openedIssues: 3, completedIssues: 2, openIssues: 6 }),
			point({ period: '2024-03-01', openedIssues: 1, completedIssues: 0, openIssues: 7 }),
			point({ period: '2024-04-01', openedIssues: 4, completedIssues: 1, openIssues: 9 })
		];
		const quarters = groupPoints(points, 'quarter');

		expect(quarters).toHaveLength(2);
		// Q1 sums Jan to Mar, backlog snapshots March's running open count
		expect(quarters[0].period).toBe('2024-01-01');
		expect(quarters[0].openedIssues).toBe(6);
		expect(quarters[0].completedIssues).toBe(3);
		expect(quarters[0].openIssues).toBe(7);
		// Q2 carries April alone
		expect(quarters[1].openedIssues).toBe(4);
		expect(quarters[1].openIssues).toBe(9);
	});
});

describe('resolveGroup', () => {
	const monthly = Array.from({ length: 40 }, (_, index) => {
		const month = (index % 12) + 1;
		const year = 2020 + Math.floor(index / 12);
		return point({ period: `${year}-${String(month).padStart(2, '0')}-01` });
	});

	it('honours an explicit choice', () => {
		expect(resolveGroup(monthly, 'quarter', 'month')).toBe('quarter');
	});

	it('auto coarsens once the finest unit blows past the bar target', () => {
		// 40 months fits under the target, so the finest unit stays
		expect(resolveGroup(monthly, 'auto', 'month')).toBe('month');
		// 100 months overflows month but its 34 quarters fit
		const long = Array.from({ length: 100 }, (_, index) =>
			point({
				period: `${2000 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`
			})
		);
		expect(resolveGroup(long, 'auto', 'month')).toBe('quarter');
		// 300 months overflows quarter too, so it falls back to year
		const huge = Array.from({ length: 300 }, (_, index) =>
			point({
				period: `${2000 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`
			})
		);
		expect(resolveGroup(huge, 'auto', 'month')).toBe('year');
	});
});

describe('flowChart', () => {
	const points = [
		point({
			period: '2024-01-01',
			openedIssues: 4,
			closedIssues: 1,
			openIssues: 3,
			openedPrs: 2,
			openPrs: 2
		}),
		point({
			period: '2024-02-01',
			openedIssues: 1,
			closedIssues: 2,
			openIssues: 2,
			openedPrs: 1,
			openPrs: 1
		})
	];

	it('builds opened bars, closed bars and backlog lines for both scopes', () => {
		const view = { ...defaultTimelineView(), scope: 'both' as const, group: 'month' as const };
		const chart = flowChart(points, view, 'month');

		expect(chart.up.map((series) => series.key)).toEqual(['openedIssues', 'openedPrs']);
		expect(chart.down.map((series) => series.key)).toEqual(['closedIssues', 'closedPrs']);
		expect(chart.lines.map((series) => series.key)).toEqual(['openIssues', 'openPrs']);
		expect(chart.bars).toHaveLength(2);
		expect(chart.bars[0].values.openedIssues).toBe(4);
		expect(chart.bars[0].values.openIssues).toBe(3);
		expect(chart.ticks).toHaveLength(2);
	});

	it('drops the backlog lines when the toggle is off', () => {
		const view = {
			...defaultTimelineView(),
			scope: 'issues' as const,
			group: 'month' as const,
			backlog: false
		};
		const chart = flowChart(points, view, 'month');
		expect(chart.lines).toHaveLength(0);
		expect(chart.bars[0].values.openIssues).toBeUndefined();
	});
});

describe('cumulativeTicks', () => {
	it('labels the year at each year change for monthly data', () => {
		const periods = ['2023-11-01', '2023-12-01', '2024-01-01', '2024-02-01'];
		const ticks = cumulativeTicks(
			periods.map((period) => point({ period })),
			'month'
		);
		expect(ticks).toEqual(['2023', '', '2024', '']);
	});

	it('labels the month at each month change for weekly data', () => {
		const periods = ['2024-01-08', '2024-01-15', '2024-02-05'];
		const ticks = cumulativeTicks(
			periods.map((period) => point({ period })),
			'week'
		);
		expect(ticks).toEqual(['Jan', '', 'Feb']);
	});

	it('labels the year once per year for quarterly data', () => {
		const periods = ['2023-07-01', '2023-10-01', '2024-01-01', '2024-04-01'];
		const ticks = cumulativeTicks(
			periods.map((period) => point({ period })),
			'quarter'
		);
		expect(ticks).toEqual(['2023', '', '2024', '']);
	});

	it('labels every bar for yearly data', () => {
		const periods = ['2022-01-01', '2023-01-01', '2024-01-01'];
		const ticks = cumulativeTicks(
			periods.map((period) => point({ period })),
			'year'
		);
		expect(ticks).toEqual(['2022', '2023', '2024']);
	});
});

describe('lifecycleBars', () => {
	it('accumulates per bucket, split into open, resolved and discarded, with monthly labels', () => {
		const points = [
			point({ period: '2023-06-01', openedIssues: 4, openIssues: 4 }),
			point({ period: '2023-12-01', completedIssues: 1, openIssues: 3 }),
			point({
				period: '2024-05-01',
				openedIssues: 2,
				completedIssues: 1,
				discardedIssues: 1,
				openIssues: 3
			})
		];
		const bars = lifecycleBars(points, 'issue', 'month');

		expect(bars).toHaveLength(3);
		expect(bars[0]).toEqual({
			label: 'Jun 23',
			values: { earlier: 0, resolved: 0, discarded: 0, open: 4 },
			total: 4
		});
		expect(bars[1]).toEqual({
			label: 'Dec 23',
			values: { earlier: 0, resolved: 1, discarded: 0, open: 3 },
			total: 4
		});
		// 2 completed and 1 not-planned cumulative, plus 3 still open
		expect(bars[2]).toEqual({
			label: 'May 24',
			values: { earlier: 0, resolved: 2, discarded: 1, open: 3 },
			total: 6
		});
	});

	it('reads the merged and closed split for PRs', () => {
		const bars = lifecycleBars(
			[point({ mergedPrs: 3, discardedPrs: 1, openPrs: 2 })],
			'pr',
			'month'
		);
		expect(bars[0].values).toEqual({ earlier: 0, resolved: 3, discarded: 1, open: 2 });
		expect(bars[0].total).toBe(6);
	});

	it('keeps omitted history in an exact cumulative baseline', () => {
		const bars = lifecycleBars([point({ openedIssues: 2, openIssues: 7 })], 'issue', 'month', {
			total: 1000,
			open: 5
		});
		expect(bars[0].values).toEqual({
			earlier: 1000,
			resolved: 0,
			discarded: 0,
			open: 2
		});
		expect(bars[0].total).toBe(1002);
	});

	it('labels weekly buckets by day and month', () => {
		const bars = lifecycleBars(
			[point({ period: '2024-01-08', openedIssues: 2, openIssues: 2 })],
			'issue',
			'week'
		);
		expect(bars[0].label).toBe('8 Jan');
	});

	it('labels quarterly and yearly buckets', () => {
		expect(
			lifecycleBars([point({ period: '2024-04-01', openIssues: 1 })], 'issue', 'quarter')[0].label
		).toBe('Q2 24');
		expect(
			lifecycleBars([point({ period: '2024-01-01', openIssues: 1 })], 'issue', 'year')[0].label
		).toBe('2024');
	});
});

describe('pointsInWindow', () => {
	const months = (back: number) => {
		const date = new Date();
		date.setUTCMonth(date.getUTCMonth() - back);
		return date.toISOString().slice(0, 10);
	};
	const points = Array.from({ length: 24 }, (_, index) => point({ period: months(23 - index) }));

	it('keeps only points within a finite window', () => {
		const windowed = pointsInWindow(points, '12');
		expect(windowed.length).toBeLessThan(points.length);
		expect(windowed.length).toBeGreaterThanOrEqual(12);
		expect(windowed.every((entry) => entry.period >= months(12))).toBe(true);
	});

	it('returns every point for the all-time window', () => {
		expect(pointsInWindow(points, 'all')).toHaveLength(24);
	});
});
