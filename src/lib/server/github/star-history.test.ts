import { describe, it, expect } from 'vitest';
import { samplePages, buildBreakdown } from '$lib/server/github/star-history';

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

	it('keeps the top repos and folds the rest into Other, carrying values forward', () => {
		const rows = [
			{ repo: 'o/a', day: '2021-01-01', stars: 100 },
			{ repo: 'o/b', day: '2021-01-01', stars: 50 },
			{ repo: 'o/c', day: '2021-06-01', stars: 10 },
			{ repo: 'o/a', day: '2022-01-01', stars: 300 }
		];
		const out = buildBreakdown(rows, repos, 2);
		expect(out.days).toEqual(['2021-01-01', '2021-06-01', '2022-01-01']);
		expect(out.series.map((item) => item.label)).toEqual(['a', 'b', 'Other']);
		expect(out.series[0].values).toEqual([100, 100, 300]);
		expect(out.series[1].values).toEqual([50, 50, 50]);
		expect(out.series[2].values).toEqual([0, 10, 10]);
	});

	it('omits Other when every repo fits, and handles no rows', () => {
		const out = buildBreakdown([{ repo: 'o/a', day: '2021-01-01', stars: 100 }], repos, 8);
		expect(out.series.map((item) => item.label)).toEqual(['a']);
		expect(buildBreakdown([], repos, 8)).toEqual({ days: [], series: [] });
	});
});
