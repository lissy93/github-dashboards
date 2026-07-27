import { describe, it, expect } from 'vitest';
import {
	summarize,
	contributionYears,
	capYears,
	hasEnoughExternal,
	contributionRows,
	contributionsConfig
} from '$lib/views/contributions';
import type { AuthoredContributions } from '$lib/types';

const data: AuthoredContributions = {
	complete: true,
	years: [
		{
			year: 2024,
			repos: [
				{
					repo: 'me/own',
					owned: true,
					lastAt: '2024-06-01',
					prs: 3,
					mergedPrs: 2,
					issues: 1,
					additions: 50,
					deletions: 10
				},
				{
					repo: 'acme/api',
					owned: false,
					lastAt: '2024-03-01',
					prs: 2,
					mergedPrs: 1,
					issues: 0,
					additions: 20,
					deletions: 5
				}
			]
		},
		{
			year: 2023,
			repos: [
				{
					repo: 'me/own',
					owned: true,
					lastAt: '2023-11-01',
					prs: 1,
					mergedPrs: 1,
					issues: 0,
					additions: 5,
					deletions: 0
				}
			]
		}
	]
};

describe('summarize', () => {
	it('sums merged PRs and issues across repos', () => {
		expect(summarize(data.years[0].repos)).toEqual({ mergedPrs: 3, issues: 1 });
	});
});

describe('contributionYears', () => {
	it('keeps all repos and computes a per-year summary', () => {
		const years = contributionYears(data, false);
		expect(years).toHaveLength(2);
		expect(years[0].summary.mergedPrs).toBe(3);
	});

	it('drops owned repos and now-empty years when external only', () => {
		const years = contributionYears(data, true);
		expect(years).toHaveLength(1);
		expect(years[0].year).toBe(2024);
		expect(years[0].repos.map((repo) => repo.repo)).toEqual(['acme/api']);
	});
});

describe('capYears', () => {
	it('caps total repo rows across years, dropping years past the limit', () => {
		const capped = capYears(contributionYears(data, false), 2);
		expect(capped.flatMap((year) => year.repos)).toHaveLength(2);
		expect(capped.map((year) => year.year)).toEqual([2024]);
	});

	it('clips a single year and re-sums to the shown repos', () => {
		const capped = capYears(contributionYears(data, false), 1);
		expect(capped).toHaveLength(1);
		expect(capped[0].repos).toHaveLength(1);
		// re-summed to just the shown repo (me/own's 2 merged PRs, not the full year)
		expect(capped[0].summary.mergedPrs).toBe(2);
	});
});

describe('hasEnoughExternal', () => {
	it('is false when distinct external repos are below the threshold', () => {
		expect(hasEnoughExternal(data)).toBe(false);
	});

	it('is true once enough distinct external repos exist', () => {
		const many: AuthoredContributions = {
			complete: true,
			years: [
				{
					year: 2024,
					repos: ['a/x', 'b/y', 'c/z'].map((repo) => ({
						repo,
						owned: false,
						lastAt: '2024-01-01',
						prs: 1,
						mergedPrs: 1,
						issues: 0,
						additions: 0,
						deletions: 0
					}))
				}
			]
		};
		expect(hasEnoughExternal(many)).toBe(true);
	});
});

describe('contributionRows', () => {
	it('flattens to one row per repo and year', () => {
		const rows = contributionRows(data);
		expect(rows).toHaveLength(3);
		expect(rows.some((row) => row.repo === 'acme/api' && row.year === 2024)).toBe(true);
	});
});

describe('contributionsConfig', () => {
	it('offers a year filter from the distinct years, newest first', () => {
		const config = contributionsConfig(contributionRows(data));
		const yearFilter = config.filters?.find((filter) => filter.key === 'year');
		expect(yearFilter?.options.map((option) => option.value)).toEqual(['2024', '2023']);
	});

	it('scope filter keeps only external repos', () => {
		const rows = contributionRows(data);
		const scope = contributionsConfig(rows).filters?.find((filter) => filter.key === 'scope');
		const external = rows.filter((row) => scope?.test(row, 'external'));
		expect(external.length).toBeGreaterThan(0);
		expect(external.every((row) => !row.owned)).toBe(true);
	});
});
