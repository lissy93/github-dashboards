import { describe, it, expect } from 'vitest';
import { buildTimeline } from '$lib/server/github/repo-timeline';

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

	it('returns no points for an empty repo', () => {
		expect(buildTimeline([], []).points).toEqual([]);
	});
});
