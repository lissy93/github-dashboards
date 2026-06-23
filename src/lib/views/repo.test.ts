import { describe, it, expect } from 'vitest';
import {
	runState,
	formatDuration,
	timelineChart,
	lifecycleBars,
	cumulativeTicks,
	pointsInWindow
} from '$lib/views/repo';

const point = (over: Partial<Parameters<typeof timelineChart>[0][number]> = {}) => ({
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

describe('timelineChart', () => {
	it('shapes the selected metrics into chart series', () => {
		const points = [point({ openedIssues: 2, closedIssues: 1, openIssues: 1 })];
		const chart = timelineChart(points, ['openIssues', 'openPrs']);

		expect(chart.dates).toEqual(['2024-01-01']);
		expect(chart.series.map((series) => series.key)).toEqual(['openIssues', 'openPrs']);
		expect(chart.series[0].values).toEqual([1]);
		expect(chart.max).toBe(1);
	});

	it('accumulates flow metrics in cumulative mode', () => {
		const points = [
			point({ period: '2024-01-01', openedIssues: 2 }),
			point({ period: '2024-02-01', openedIssues: 3 }),
			point({ period: '2024-03-01', openedIssues: 1 })
		];
		const flat = timelineChart(points, ['openedIssues']);
		const cumulative = timelineChart(points, ['openedIssues'], { cumulative: true });

		expect(flat.series[0].values).toEqual([2, 3, 1]);
		expect(cumulative.series[0].values).toEqual([2, 5, 6]);
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
			values: { resolved: 0, discarded: 0, open: 4 },
			total: 4
		});
		expect(bars[1]).toEqual({
			label: 'Dec 23',
			values: { resolved: 1, discarded: 0, open: 3 },
			total: 4
		});
		// 2 completed and 1 not-planned cumulative, plus 3 still open
		expect(bars[2]).toEqual({
			label: 'May 24',
			values: { resolved: 2, discarded: 1, open: 3 },
			total: 6
		});
	});

	it('reads the merged and closed split for PRs', () => {
		const bars = lifecycleBars(
			[point({ mergedPrs: 3, discardedPrs: 1, openPrs: 2 })],
			'pr',
			'month'
		);
		expect(bars[0].values).toEqual({ resolved: 3, discarded: 1, open: 2 });
		expect(bars[0].total).toBe(6);
	});

	it('labels weekly buckets by day and month', () => {
		const bars = lifecycleBars(
			[point({ period: '2024-01-08', openedIssues: 2, openIssues: 2 })],
			'issue',
			'week'
		);
		expect(bars[0].label).toBe('8 Jan');
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
