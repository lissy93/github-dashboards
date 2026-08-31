import { describe, it, expect } from 'vitest';
import {
	summarize,
	contributionYears,
	capYears,
	panelYears,
	hasEnoughExternal,
	contributionRows,
	contributionsConfig,
	contributionOwners,
	contributionTotals,
	contributionYearBars,
	topContributionRepos,
	visibleContributions,
	acrossYears,
	defaultContributionsView
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
					closedPrs: 1,
					issues: 1,
					closedIssues: 1,
					additions: 50,
					deletions: 10
				},
				{
					repo: 'acme/api',
					owned: false,
					lastAt: '2024-03-01',
					prs: 2,
					mergedPrs: 1,
					closedPrs: 0,
					issues: 0,
					closedIssues: 0,
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
					closedPrs: 0,
					issues: 0,
					closedIssues: 0,
					additions: 5,
					deletions: 0
				}
			]
		}
	]
};

// A second repo the user opened PRs against but never landed one in
const unmerged: AuthoredContributions = {
	complete: true,
	years: [
		{
			year: 2024,
			repos: [
				data.years[0].repos[0],
				{
					repo: 'acme/docs',
					owned: false,
					lastAt: '2024-05-01',
					prs: 4,
					mergedPrs: 0,
					closedPrs: 2,
					issues: 2,
					closedIssues: 1,
					additions: 0,
					deletions: 0
				}
			]
		}
	]
};

describe('summarize', () => {
	it('sums opened PRs, merged PRs and issues across repos', () => {
		expect(summarize(data.years[0].repos)).toEqual({
			prs: 5,
			mergedPrs: 3,
			closedPrs: 1,
			issues: 1,
			closedIssues: 1
		});
	});
});

describe('contributionYears', () => {
	it('keeps all repos and computes a per-year summary', () => {
		const years = contributionYears(data, false);
		expect(years).toHaveLength(2);
		expect(years[0].summary.mergedPrs).toBe(3);
	});

	it('drops repos with no merged PR when merged only', () => {
		const years = contributionYears(unmerged, false, true);
		expect(years.map((year) => year.repos.map((repo) => repo.repo))).toEqual([['me/own']]);
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

describe('panelYears', () => {
	it('shows landed work only, so an opened-but-unmerged repo is left out', () => {
		expect(
			panelYears(unmerged, false).flatMap((year) => year.repos.map((repo) => repo.repo))
		).toEqual(['me/own']);
	});
});

describe('hasEnoughExternal', () => {
	it('is false when distinct external repos are below the threshold', () => {
		expect(hasEnoughExternal(data)).toBe(false);
	});

	it('ignores external repos where nothing was merged', () => {
		const many: AuthoredContributions = {
			complete: true,
			years: [
				{
					year: 2024,
					repos: ['a/x', 'b/y', 'c/z'].map((repo, index) => ({
						repo,
						owned: false,
						lastAt: '2024-01-01',
						prs: 1,
						mergedPrs: index === 0 ? 1 : 0,
						closedPrs: 0,
						issues: 0,
						closedIssues: 0,
						additions: 0,
						deletions: 0
					}))
				}
			]
		};
		expect(hasEnoughExternal(many)).toBe(false);
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
						closedPrs: 0,
						issues: 0,
						closedIssues: 0,
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

describe('contributionOwners', () => {
	it('totals each owner across years and sorts by pull requests', () => {
		const owners = contributionOwners(data, false);
		expect(owners.map((owner) => owner.owner)).toEqual(['me', 'acme']);
		expect(owners[0]).toMatchObject({
			owner: 'me',
			owned: true,
			prs: 4,
			mergedPrs: 3,
			issues: 1,
			additions: 55,
			deletions: 10,
			repos: 2
		});
		expect(owners[1]).toMatchObject({ owner: 'acme', owned: false, prs: 2, repos: 1 });
	});

	it('drops the user own namespace when external only', () => {
		const owners = contributionOwners(data, true);
		expect(owners.map((owner) => owner.owner)).toEqual(['acme']);
		expect(owners.every((owner) => !owner.owned)).toBe(true);
	});

	it('drops owners with no merged PR and ranks the rest by merged when merged only', () => {
		const owners = contributionOwners(unmerged, false, true);
		expect(owners.map((owner) => owner.owner)).toEqual(['me']);
	});
});

describe('contributionsConfig', () => {
	it('offers a year filter from the distinct years, newest first', () => {
		const config = contributionsConfig(contributionRows(data));
		const yearFilter = config.filters?.find((filter) => filter.key === 'year');
		expect(yearFilter?.options.map((option) => option.value)).toEqual(['2024', '2023']);
	});

	it('activity filter keeps only repos with a merged pull request', () => {
		const rows = [
			...contributionRows(data),
			{
				repo: 'acme/docs',
				owned: false,
				lastAt: '2024-01-01',
				prs: 2,
				mergedPrs: 0,
				closedPrs: 1,
				issues: 4,
				closedIssues: 3,
				additions: 0,
				deletions: 0,
				year: 2024
			}
		];
		const activity = contributionsConfig(rows).filters?.find((filter) => filter.key === 'activity');
		expect(rows.filter((row) => activity?.test(row, 'merged')).map((row) => row.repo)).toEqual([
			'me/own',
			'acme/api',
			'me/own'
		]);
		expect(rows.filter((row) => activity?.test(row, 'issues')).map((row) => row.repo)).toEqual([
			'me/own',
			'acme/docs'
		]);
	});

	it('offers a merged pull request sort', () => {
		const config = contributionsConfig(contributionRows(data));
		const merged = config.sorts.find((sort) => sort.key === 'merged');
		expect(merged?.value(contributionRows(data)[0])).toBe(2);
	});

	it('scope filter keeps only external repos', () => {
		const rows = contributionRows(data);
		const scope = contributionsConfig(rows).filters?.find((filter) => filter.key === 'scope');
		const external = rows.filter((row) => scope?.test(row, 'external'));
		expect(external.length).toBeGreaterThan(0);
		expect(external.every((row) => !row.owned)).toBe(true);
	});
});

describe('contribution summary and charts', () => {
	const rows = contributionRows(data);

	it('totals repos, owners and years once each', () => {
		const totals = contributionTotals(rows);
		expect(totals).toMatchObject({
			repos: 2,
			owners: 2,
			prs: 6,
			mergedPrs: 4,
			closedPrs: 1,
			issues: 1,
			closedIssues: 1
		});
		expect(totals.additions).toBe(75);
		expect(totals.deletions).toBe(15);
		expect(totals.years).toEqual([2023, 2024]);
	});

	it('builds one bar per year, oldest first, splitting both kinds by outcome', () => {
		const bars = contributionYearBars(rows);
		expect(bars.map((bar) => bar.label)).toEqual(['2023', '2024']);
		expect(bars[1].values).toEqual({
			merged: 3,
			closed: 1,
			open: 1,
			closedIssues: 1,
			openIssues: 0
		});
		expect(bars[1].total).toBe(6);
	});

	it('ranks repos by the active metric and links to each one', () => {
		const merged = topContributionRepos(rows, 'merged', 10);
		expect(merged.map((slice) => [slice.label, slice.value])).toEqual([
			['me/own', 3],
			['acme/api', 1]
		]);
		expect(merged[0].href).toBe('/me/own');
		expect(topContributionRepos(rows, 'issues', 10).map((slice) => slice.label)).toEqual([
			'me/own'
		]);
	});

	it('breaks each repo bar into parts that sum to its own value', () => {
		const [top] = topContributionRepos(rows, '', 10);
		expect(top.segments?.map((part) => [part.key, part.value])).toEqual([
			['merged', 3],
			['closed', 1],
			['closedIssues', 1]
		]);
		expect(top.segments?.reduce((sum, part) => sum + part.value, 0)).toBe(top.value);
	});

	it('leaves a single-series metric as a plain bar', () => {
		expect(topContributionRepos(rows, 'merged', 10)[0].segments).toEqual([]);
	});

	it('follows the list filters, and lifts only the year for the all-years chart', () => {
		const view = {
			...defaultContributionsView(),
			filters: { activity: '', year: '2024', scope: 'external' }
		};
		expect(visibleContributions(data, view).map((row) => row.repo)).toEqual(['acme/api']);
		expect(contributionYearBars(visibleContributions(data, acrossYears(view)))).toHaveLength(1);
	});
});
