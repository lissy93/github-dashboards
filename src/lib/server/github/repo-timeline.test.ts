import { describe, it, expect } from 'vitest';
import {
	buildTimeline,
	issueResolved,
	resolutionStats,
	timelineContribution,
	type TimelineState
} from '$lib/server/github/repo-timeline';

const point = (points: ReturnType<typeof buildTimeline>['points'], period: string) =>
	points.find((entry) => entry.period === period);

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

describe('buildTimeline', () => {
	it('buckets opened and closed counts by month for an older repo', () => {
		const issues = [
			{ createdAt: '2024-01-10T00:00:00Z', closedAt: '2024-02-05T00:00:00Z' },
			{ createdAt: '2024-01-20T00:00:00Z', closedAt: null },
			{ createdAt: '2024-03-01T00:00:00Z', closedAt: null }
		];
		const { points, granularity } = buildTimeline(issues, []);

		expect(granularity).toBe('month');
		expect(point(points, '2024-01-01')?.openedIssues).toBe(2);
		expect(point(points, '2024-02-01')?.closedIssues).toBe(1);
		expect(point(points, '2024-03-01')?.openedIssues).toBe(1);
	});

	it('tracks a running open count that never goes negative', () => {
		const issues = [
			{ createdAt: '2024-01-10T00:00:00Z', closedAt: '2024-01-20T00:00:00Z' },
			{ createdAt: '2024-02-10T00:00:00Z', closedAt: null }
		];
		const { points } = buildTimeline(issues, []);

		expect(point(points, '2024-01-01')?.openIssues).toBe(0);
		expect(point(points, '2024-02-01')?.openIssues).toBe(1);
		expect(points.every((entry) => entry.openIssues >= 0)).toBe(true);
		// The latest month carries the running total forward: 2 opened, 1 closed
		expect(points.at(-1)?.openIssues).toBe(1);
	});

	it('separates issue and PR series', () => {
		const issues = [{ createdAt: '2024-05-01T00:00:00Z', closedAt: null }];
		const prs = [{ createdAt: '2024-05-02T00:00:00Z', closedAt: null }];
		const { points, sampled } = buildTimeline(issues, prs, true);

		expect(point(points, '2024-05-01')?.openedIssues).toBe(1);
		expect(point(points, '2024-05-01')?.openedPrs).toBe(1);
		expect(sampled).toBe(true);
	});

	it('carries omitted open items into a sampled timeline baseline', () => {
		const issues = [{ createdAt: '2024-05-01T00:00:00Z', closedAt: null }];
		const { points } = buildTimeline(issues, [], true, { issues: 12, prs: 0 });

		expect(point(points, '2024-05-01')?.openIssues).toBe(13);
		expect(points.at(-1)?.openIssues).toBe(13);
	});

	it('buckets by week when the repo has under a year of history', () => {
		const issues = [
			{ createdAt: daysAgo(60), closedAt: null },
			{ createdAt: daysAgo(7), closedAt: null }
		];
		const { points, granularity } = buildTimeline(issues, []);

		expect(granularity).toBe('week');
		// Weekly buckets are dated to a Monday and span the full ~8 weeks
		expect(points.every((entry) => entry.period.length === 10)).toBe(true);
		expect(points.length).toBeGreaterThanOrEqual(8);
	});

	it('splits closed items into resolved and discarded', () => {
		const issues = [
			{ createdAt: '2024-01-01T00:00:00Z', closedAt: '2024-02-05T00:00:00Z', resolved: true },
			{ createdAt: '2024-01-02T00:00:00Z', closedAt: '2024-02-10T00:00:00Z', resolved: false }
		];
		const prs = [
			{ createdAt: '2024-01-03T00:00:00Z', closedAt: '2024-02-15T00:00:00Z', resolved: true }
		];
		const { points } = buildTimeline(issues, prs);

		expect(point(points, '2024-02-01')?.completedIssues).toBe(1);
		expect(point(points, '2024-02-01')?.discardedIssues).toBe(1);
		expect(point(points, '2024-02-01')?.closedIssues).toBe(2);
		expect(point(points, '2024-02-01')?.mergedPrs).toBe(1);
		expect(point(points, '2024-02-01')?.discardedPrs).toBe(0);
	});

	it('records the median resolution hours for items closed in a bucket', () => {
		// Two issues closed in Feb, resolved 24h and 72h after opening, median 48h
		const issues = [
			{ createdAt: '2024-02-01T00:00:00Z', closedAt: '2024-02-02T00:00:00Z', resolved: true },
			{ createdAt: '2024-02-01T00:00:00Z', closedAt: '2024-02-04T00:00:00Z', resolved: true },
			{ createdAt: '2024-02-01T00:00:00Z', closedAt: '2024-02-10T00:00:00Z', resolved: false }
		];
		const { points } = buildTimeline(issues, []);
		expect(point(points, '2024-02-01')?.resolveIssuesHours).toBe(48);
		expect(point(points, '2024-02-01')?.resolvePrsHours).toBeNull();
	});

	it('treats a closed item with no resolved flag as resolved', () => {
		const issues = [{ createdAt: '2024-01-01T00:00:00Z', closedAt: '2024-02-05T00:00:00Z' }];
		const { points } = buildTimeline(issues, []);
		expect(point(points, '2024-02-01')?.completedIssues).toBe(1);
		expect(point(points, '2024-02-01')?.discardedIssues).toBe(0);
	});

	it('returns no points for an empty repo', () => {
		expect(buildTimeline([], []).points).toEqual([]);
	});
});

describe('timelineContribution', () => {
	const state = (issues: TimelineState['issues'], prs: TimelineState['prs']): TimelineState => ({
		issues,
		prs
	});
	const crawl = <T>(
		nodes: T[],
		extra: { complete?: boolean; total?: number; openTotal?: number } = {}
	) => ({
		nodes,
		cursor: null as string | null,
		complete: true,
		total: nodes.length,
		openTotal: 0,
		...extra
	});

	it('maps issue state reason and PR merged flag onto the resolved flag', () => {
		const part = timelineContribution(
			state(
				crawl([
					{ id: '1', createdAt: '2024-01-01', closedAt: '2024-02-01', stateReason: 'COMPLETED' },
					{ id: '2', createdAt: '2024-01-02', closedAt: '2024-02-02', stateReason: 'NOT_PLANNED' }
				]),
				crawl([{ id: '3', createdAt: '2024-01-03', closedAt: '2024-02-03', merged: true }])
			)
		);
		expect(part.issues.map((node) => node.resolved)).toEqual([true, false]);
		expect(part.prs[0].resolved).toBe(true);
		expect(part.complete).toBe(true);
	});

	it('has a zero baseline once both kinds are fully crawled', () => {
		const part = timelineContribution(
			state(
				crawl([{ id: '1', createdAt: '2024-01-01', closedAt: null, stateReason: null }]),
				crawl([])
			)
		);
		expect(part.baseline).toEqual({ issues: { total: 0, open: 0 }, prs: { total: 0, open: 0 } });
	});

	it('counts the uncrawled tail into the baseline when a kind is incomplete', () => {
		const part = timelineContribution(
			state(
				crawl([{ id: '1', createdAt: '2024-01-01', closedAt: null, stateReason: null }], {
					complete: false,
					total: 10,
					openTotal: 4
				}),
				crawl([])
			)
		);
		// 10 issues exist, 1 crawled, so 9 sit in the baseline; 4 open minus the 1 open crawled leaves 3
		expect(part.baseline.issues).toEqual({ total: 9, open: 3 });
		expect(part.complete).toBe(false);
	});
});

describe('issueResolved', () => {
	it('counts completed and reopened issues as resolved', () => {
		expect(issueResolved('COMPLETED')).toBe(true);
		expect(issueResolved(null)).toBe(true);
	});

	it('counts not-planned and duplicate issues as discarded', () => {
		expect(issueResolved('NOT_PLANNED')).toBe(false);
		expect(issueResolved('DUPLICATE')).toBe(false);
	});
});

describe('resolutionStats', () => {
	it('is empty with a null median when nothing resolved', () => {
		const stats = resolutionStats([]);
		expect(stats.count).toBe(0);
		expect(stats.medianHours).toBeNull();
		expect(stats.buckets.every((bucket) => bucket.count === 0)).toBe(true);
	});

	it('takes the middle value of an odd set and the mean of two for an even set', () => {
		expect(resolutionStats([1, 50, 9]).medianHours).toBe(9);
		expect(resolutionStats([2, 10]).medianHours).toBe(6);
	});

	it('drops each duration into the right band, open-ended at the top', () => {
		// 0.5h, 5h, 3d, 20d, 100d, 400d span every band in order
		const hours = [0.5, 5, 3 * 24, 20 * 24, 100 * 24, 400 * 24];
		const counts = resolutionStats(hours).buckets.map((bucket) => bucket.count);
		expect(counts).toEqual([1, 1, 1, 1, 1, 1]);
		expect(resolutionStats(hours).buckets.map((bucket) => bucket.label)).toEqual([
			'< 1h',
			'< 1d',
			'< 1w',
			'< 1mo',
			'< 6mo',
			'6mo+'
		]);
	});
});
