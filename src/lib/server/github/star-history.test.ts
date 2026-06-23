import { describe, it, expect } from 'vitest';
import {
	samplePages,
	buildBreakdown,
	pageBudget,
	pointTarget,
	perStarPoints
} from '$lib/server/github/star-history';

describe('samplePages', () => {
	it('returns every page when there are fewer than the cap', () => {
		expect(samplePages(1, 15)).toEqual([1]);
		expect(samplePages(5, 15)).toEqual([1, 2, 3, 4, 5]);
	});

	it('samples evenly across both ends when there are more pages than the cap', () => {
		const pages = samplePages(100, 15);
		expect(pages.length).toBeLessThanOrEqual(15);
		expect(pages[0]).toBe(1);
		expect(pages.at(-1)).toBe(100);
		expect([...pages].sort((first, second) => first - second)).toEqual(pages);
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

describe('pageBudget', () => {
	it('fetches every page for small repos and stays sparse for huge ones', () => {
		expect(pageBudget(1)).toBe(1);
		expect(pageBudget(10)).toBe(10);
		expect(pageBudget(40)).toBe(10);
		expect(pageBudget(500)).toBe(4);
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

describe('perStarPoints', () => {
	const day = (index: number) => `2021-01-${String((index % 28) + 1).padStart(2, '0')}`;
	const page = (count: number, from: number) =>
		Array.from({ length: count }, (_, index) => ({ starred_at: `${day(from + index)}T00:00:00Z` }));

	it('traces a point per star for a tiny repo and pins the real total at the end', () => {
		const out = perStarPoints([1], new Map([[1, page(8, 0)]]), 8);
		// 8 stars, target 8 so stride 1: a rising point each plus the pinned total
		expect(out.map((point) => point.stars)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 8]);
		expect(out.every((point, index) => index === 0 || point.stars >= out[index - 1].stars)).toBe(
			true
		);
	});

	it('strides down to the target count for a larger repo and keeps counts rising', () => {
		const byPage = new Map([
			[1, page(100, 0)],
			[2, page(50, 100)]
		]);
		const out = perStarPoints([1, 2], byPage, 150);
		// 150 stars, target 60 so stride 3, plus the pinned final total
		expect(out.length).toBe(Math.ceil(150 / 3) + 1);
		expect(out.at(-1)).toEqual({ day: day(149), stars: 150 });
		const counts = out.map((point) => point.stars);
		expect([...counts].sort((first, second) => first - second)).toEqual(counts);
	});
});
