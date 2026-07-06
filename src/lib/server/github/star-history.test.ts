import { describe, it, expect } from 'vitest';
import {
	curvePoints,
	stride,
	buildBreakdown,
	pageBudget,
	isFullWalk,
	isSampled,
	pointTarget
} from '$lib/server/github/star-history';

describe('curvePoints', () => {
	it('traces a point per star when one walk covers the whole repo', () => {
		const oldest = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05'];
		const points = curvePoints(oldest, [], 5);
		expect(points.map((point) => point.stars)).toEqual([1, 2, 3, 4, 5]);
		expect(points.at(-1)).toEqual({ day: '2024-01-05', stars: 5 });
	});

	it('joins the oldest and newest ends into one rising series, counting down from the total', () => {
		const oldest = ['2020-01-01', '2020-01-02', '2020-01-03'];
		// DESC fetch order: most recent star first
		const newest = ['2024-03-03', '2024-03-02', '2024-03-01'];
		expect(curvePoints(oldest, newest, 100)).toEqual([
			{ day: '2020-01-01', stars: 1 },
			{ day: '2020-01-02', stars: 2 },
			{ day: '2020-01-03', stars: 3 },
			{ day: '2024-03-01', stars: 98 },
			{ day: '2024-03-02', stars: 99 },
			{ day: '2024-03-03', stars: 100 }
		]);
	});

	it('returns nothing when both ends are empty, so a restricted repo is detectable', () => {
		expect(curvePoints([], [], 500)).toEqual([]);
	});

	it('thins a large full walk to the target count while pinning the real total last', () => {
		const oldest = Array.from({ length: 200 }, (_, index) => `2021-star-${index}`);
		const points = curvePoints(oldest, [], 200);
		// 200 points, target 60 so stride 4, plus the kept final total
		expect(points.length).toBe(Math.ceil(200 / 4) + 1);
		expect(points.at(-1)).toEqual({ day: '2021-star-199', stars: 200 });
		const counts = points.map((point) => point.stars);
		expect([...counts].sort((first, second) => first - second)).toEqual(counts);
	});
});

describe('stride', () => {
	const points = Array.from({ length: 10 }, (_, index) => ({ day: `d${index}`, stars: index + 1 }));

	it('leaves a short series untouched', () => {
		expect(stride(points.slice(0, 3), 5)).toEqual(points.slice(0, 3));
	});

	it('thins to about the target and always keeps the first and last', () => {
		const out = stride(points, 3);
		expect(out[0]).toEqual(points[0]);
		expect(out.at(-1)).toEqual(points.at(-1));
		expect(out.length).toBeLessThanOrEqual(4);
	});
});

describe('pageBudget', () => {
	it('reads more pages per end for mid repos and stays sparse for huge ones', () => {
		expect(pageBudget(1)).toBe(10);
		expect(pageBudget(100)).toBe(10);
		expect(pageBudget(101)).toBe(4);
		expect(pageBudget(500)).toBe(4);
	});
});

describe('isFullWalk', () => {
	it('reads small repos whole and samples once both ends cannot cover every page', () => {
		expect(isFullWalk(1)).toBe(true);
		expect(isFullWalk(20)).toBe(true);
		expect(isFullWalk(21)).toBe(false);
		expect(isFullWalk(500)).toBe(false);
	});
});

describe('isSampled', () => {
	it('flags the curve as sampled only once a repo outgrows a full walk', () => {
		expect(isSampled(50)).toBe(false);
		expect(isSampled(2000)).toBe(false);
		expect(isSampled(2001)).toBe(true);
		expect(isSampled(50000)).toBe(true);
	});
});

describe('pointTarget', () => {
	it('aims for more points the smaller the repo', () => {
		expect(pointTarget(8)).toBe(8);
		expect(pointTarget(50)).toBe(40);
		expect(pointTarget(500)).toBe(60);
		expect(pointTarget(5000)).toBe(80);
	});
});

describe('buildBreakdown', () => {
	const repos = [
		{ nameWithOwner: 'o/a', name: 'a', stars: 300 },
		{ nameWithOwner: 'o/b', name: 'b', stars: 50 },
		{ nameWithOwner: 'o/c', name: 'c', stars: 10 }
	];

	it('keeps the top repos and folds the rest into Other, interpolating between samples', () => {
		const rows = [
			{ repo: 'o/a', day: '2021-01-01', stars: 100 },
			{ repo: 'o/b', day: '2021-01-01', stars: 50 },
			{ repo: 'o/c', day: '2021-06-01', stars: 10 },
			{ repo: 'o/a', day: '2022-01-01', stars: 300 }
		];
		const out = buildBreakdown(rows, repos, 2);
		expect(out.days).toEqual(['2021-01-01', '2021-06-01', '2022-01-01']);
		expect(out.series.map((item) => item.label)).toEqual(['a', 'b', 'Other']);
		// a ramps from 100 to 300, so mid-axis sits proportionally between them
		expect(out.series[0].values).toEqual([100, 183, 300]);
		// b has a single sample, held flat past it; c stays 0 until its first sample
		expect(out.series[1].values).toEqual([50, 50, 50]);
		expect(out.series[2].values).toEqual([0, 10, 10]);
	});

	it('omits Other when every repo fits, and handles no rows', () => {
		const out = buildBreakdown([{ repo: 'o/a', day: '2021-01-01', stars: 100 }], repos, 8);
		expect(out.series.map((item) => item.label)).toEqual(['a']);
		expect(buildBreakdown([], repos, 8)).toEqual({ days: [], series: [] });
	});
});
