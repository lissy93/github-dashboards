import { describe, it, expect } from 'vitest';
import {
	languageBreakdown,
	topRepos,
	REPO_METRICS,
	starHistory,
	contributionLevels,
	contributionsPerYear,
	visibleContributionYears,
	funFacts
} from '$lib/views/stats';
import type {
	ActivityRhythm,
	ContributionDay,
	LanguageUsage,
	Repo,
	UserContributions,
	YearCalendar
} from '$lib/types';

// Minimal repo factory, only the fields the aggregations read
function repo(partial: Partial<Repo>): Repo {
	return {
		owner: 'a',
		name: 'r',
		nameWithOwner: 'a/r',
		description: null,
		url: '',
		stars: 0,
		forks: 0,
		watchers: 0,
		openIssues: 0,
		openPRs: 0,
		diskUsage: 0,
		language: null,
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
		pushedAt: '2024-01-01T00:00:00Z',
		isPrivate: false,
		isArchived: false,
		isFork: false,
		license: null,
		...partial
	};
}

describe('languageBreakdown', () => {
	it('keeps byte order and reports share and repo counts', () => {
		const usage: LanguageUsage[] = [
			{ name: 'TS', color: '#3178c6', bytes: 750, repos: 3 },
			{ name: 'Go', color: '#00ADD8', bytes: 250, repos: 1 }
		];
		const out = languageBreakdown(usage);
		expect(out.map((slice) => slice.label)).toEqual(['TS', 'Go']);
		expect(out[0]).toMatchObject({ value: 750, color: '#3178c6' });
		// Share is computed against the combined byte total
		expect(out[0].rows?.find((row) => row.label === 'Share')?.value).toBe('75%');
		expect(out[0].rows?.find((row) => row.label === 'Repos')?.value).toBe('3');
	});

	it('rolls the long tail into a single Other slice with its count', () => {
		const usage: LanguageUsage[] = Array.from({ length: 5 }, (_, index) => ({
			name: `L${index}`,
			color: null,
			bytes: 50 - index * 10,
			repos: 1
		}));
		const out = languageBreakdown(usage, 3);
		expect(out.map((slice) => slice.label)).toEqual(['L0', 'L1', 'Other (3)']);
		// Other sums the three trailing languages (30 + 20 + 10)
		expect(out[2].value).toBe(60);
	});
});

describe('starHistory', () => {
	it('totals the series per day and keeps the full range for small accounts', () => {
		const stack = starHistory({
			days: ['2020-01-01', '2021-01-01'],
			series: [
				{ label: 'a', values: [5, 30] },
				{ label: 'b', values: [0, 10] }
			]
		});
		expect(stack.days).toEqual(['2020-01-01', '2021-01-01']);
		expect(stack.total).toEqual([5, 40]);
		expect(stack.series[1]).toEqual({ label: 'b', values: [0, 10] });
	});

	it('trims to the 1% milestone only for accounts over 10k stars', () => {
		const stack = starHistory({
			days: ['2019-01-01', '2020-01-01', '2021-01-01'],
			series: [{ label: 'a', values: [50, 300, 30000] }]
		});
		expect(stack.days).toEqual(['2020-01-01', '2021-01-01']);
		expect(stack.total).toEqual([300, 30000]);
	});

	it('handles an empty breakdown', () => {
		expect(starHistory({ days: [], series: [] })).toEqual({ days: [], series: [], total: [] });
	});
});

describe('topRepos', () => {
	const byKey = (key: string) => REPO_METRICS.find((metric) => metric.key === key)!;

	it('ranks by stars, drops zero-metric and forked repos', () => {
		const repos = [
			repo({ name: 'big', stars: 50 }),
			repo({ name: 'mid', stars: 20 }),
			repo({ name: 'empty', stars: 0 }),
			repo({ name: 'forked', stars: 99, isFork: true })
		];
		const out = topRepos(repos, byKey('stars'), {});
		expect(out.map((row) => row.label)).toEqual(['big', 'mid']);
		expect(out[0].rows?.[0]).toEqual({ label: 'Stars', value: '50' });
	});

	it('ranks by another metric and formats its value', () => {
		const repos = [
			repo({ name: 'small', diskUsage: 512 }),
			repo({ name: 'huge', diskUsage: 4096 }),
			repo({ name: 'zero', diskUsage: 0 })
		];
		const out = topRepos(repos, byKey('size'), {});
		expect(out.map((row) => row.label)).toEqual(['huge', 'small']);
		expect(out[0].value).toBe(4096);
		expect(out[0].rows?.[0]).toEqual({ label: 'Size', value: '4 MB' });
	});

	it('ranks a lazy metric off the loaded maps, keyed by nameWithOwner', () => {
		const repos = [
			repo({ name: 'a', nameWithOwner: 'o/a' }),
			repo({ name: 'b', nameWithOwner: 'o/b' }),
			repo({ name: 'c', nameWithOwner: 'o/c' })
		];
		const contributors = { 'o/a': 3, 'o/b': 9 };
		const out = topRepos(repos, byKey('contributors'), { contributors });
		expect(out.map((row) => row.label)).toEqual(['b', 'a']);
		expect(out[0].rows?.[0]).toEqual({ label: 'Contributors', value: '9' });
	});

	it('returns nothing for a lazy metric before its map loads', () => {
		const repos = [repo({ name: 'a' }), repo({ name: 'b' })];
		expect(topRepos(repos, byKey('commits'), {})).toEqual([]);
	});
});

describe('contributionLevels', () => {
	it('scales counts into five levels off the busiest day', () => {
		const days = [
			{ date: '2026-01-01', count: 0 },
			{ date: '2026-01-02', count: 1 },
			{ date: '2026-01-03', count: 5 },
			{ date: '2026-01-04', count: 10 }
		];
		expect(contributionLevels(days).map((day) => day.level)).toEqual([0, 1, 2, 4]);
	});
});

describe('contributionsPerYear', () => {
	it('orders years ascending and splits each into stacked kind values', () => {
		const years: YearCalendar[] = [
			{ year: 2025, total: 10, days: [], commits: 6, issues: 1, prs: 2, reviews: 1, restricted: 0 },
			{ year: 2024, total: 4, days: [], commits: 4, issues: 0, prs: 0, reviews: 0, restricted: 0 }
		];
		const out = contributionsPerYear(years);
		expect(out.map((bar) => bar.label)).toEqual(['2024', '2025']);
		expect(out[1].values).toMatchObject({ commits: 6, prs: 2, issues: 1, reviews: 1 });
	});

	it('derives Other from calendar days the typed totals do not cover', () => {
		const years: YearCalendar[] = [
			{ year: 2024, total: 12, days: [], commits: 5, issues: 1, prs: 1, reviews: 0, restricted: 0 }
		];
		const [bar] = contributionsPerYear(years);
		// total 12 minus the 7 typed contributions leaves 5 unattributed
		expect(bar.values.other).toBe(5);
		expect(bar.total).toBe(12);
	});
});

describe('visibleContributionYears', () => {
	const year = (yr: number, total: number): YearCalendar => ({
		year: yr,
		total,
		days: [],
		commits: total,
		issues: 0,
		prs: 0,
		reviews: 0,
		restricted: 0
	});

	it('drops sub-100 years once a busy year exists', () => {
		const years = [year(2026, 400), year(2025, 100), year(2024, 30)];
		expect(visibleContributionYears(years).map((entry) => entry.year)).toEqual([2026, 2025]);
	});

	it('keeps every year when no year breaks 100', () => {
		const years = [year(2026, 80), year(2025, 40)];
		expect(visibleContributionYears(years)).toHaveLength(2);
	});
});

describe('funFacts', () => {
	// A contiguous run of days, matching how GitHub returns every calendar day
	const run = (start: string, counts: number[]): ContributionDay[] =>
		counts.map((count, offset) => {
			const date = new Date(`${start}T00:00:00Z`);
			date.setUTCDate(date.getUTCDate() + offset);
			return { date: date.toISOString().slice(0, 10), count };
		});

	const calendar = (yr: number, days: ContributionDay[]): YearCalendar => ({
		year: yr,
		total: days.reduce((sum, day) => sum + day.count, 0),
		days,
		commits: 0,
		issues: 0,
		prs: 0,
		reviews: 0,
		restricted: 0
	});

	const contributions = (years: YearCalendar[]): UserContributions => ({
		total: years.reduce((sum, year) => sum + year.total, 0),
		totals: { commits: 0, issues: 0, prs: 0, reviews: 0, restricted: 0 },
		years
	});

	const days2026 = run('2026-06-10', [2, 0, 3, 3, 3, 3, 0, 5, 5]);
	const data = contributions([calendar(2026, days2026)]);

	const find = (facts: { label: string; value: string; hint: string }[], label: string) =>
		facts.find((fact) => fact.label === label);

	const languages: LanguageUsage[] = [
		{ name: 'TS', color: null, bytes: 800, repos: 5 },
		{ name: 'Go', color: null, bytes: 200, repos: 2 }
	];

	const punch = Array.from({ length: 7 }, () => new Array(24).fill(0));
	punch[0][14] = 6;
	punch[1][9] = 4;
	const rhythm: ActivityRhythm = { total: 10, punch, peak: { weekday: 0, hour: 14, count: 6 } };

	it('counts the current and longest contribution streaks', () => {
		const facts = funFacts(data, rhythm, languages);
		// Trailing run is Jun 17 to 18, the longest is the four day Jun 12 to 15 run
		expect(find(facts, 'Current streak')?.value).toBe('2 days');
		expect(find(facts, 'Longest streak')?.value).toBe('4 days');
	});

	it('reports the biggest day, best year and top language', () => {
		const facts = funFacts(data, rhythm, languages);
		expect(find(facts, 'Biggest day')?.value).toBe('5');
		expect(find(facts, 'Best year')?.value).toBe('2026');
		expect(find(facts, 'Top language')?.value).toBe('TS');
		expect(find(facts, 'Top language')?.hint).toContain('80%');
	});

	it('derives the peak hour from the rhythm summed across weekdays', () => {
		expect(find(funFacts(data, rhythm, languages), 'Peak hour')?.value).toBe('14:00 UTC');
	});

	it('drops rhythm and language facts when that data is absent', () => {
		const facts = funFacts(data, null, []);
		expect(find(facts, 'Peak hour')).toBeUndefined();
		expect(find(facts, 'Top language')).toBeUndefined();
		expect(find(facts, 'Current streak')).toBeDefined();
	});

	it('returns nothing when there are no calendar days', () => {
		expect(funFacts(contributions([]), null, [])).toEqual([]);
	});
});
