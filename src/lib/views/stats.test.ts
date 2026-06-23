import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	languageBreakdown,
	topRepos,
	REPO_METRICS,
	starHistory,
	contributionLevels,
	contributionsPerYear,
	visibleContributionYears,
	funFacts,
	topicCloud,
	topicCount,
	licenseBreakdown,
	repoRecency,
	reposPerYear,
	lifecycleSegments,
	projectLifecycles,
	portfolioScatter,
	SCATTER_AXES,
	issueFlow,
	prFlow
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
		topics: [],
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

	it('ranks by stars, dropping zero-metric repos and pristine forks but keeping starred forks', () => {
		const repos = [
			repo({ name: 'big', stars: 50 }),
			repo({ name: 'mid', stars: 20 }),
			repo({ name: 'empty', stars: 0 }),
			repo({ name: 'pristine-fork', stars: 0, isFork: true }),
			repo({ name: 'starred-fork', stars: 99, isFork: true })
		];
		const out = topRepos(repos, byKey('stars'), {});
		expect(out.map((row) => row.label)).toEqual(['starred-fork', 'big', 'mid']);
		expect(out[0].rows?.[0]).toEqual({ label: 'Stars', value: '99' });
	});

	it('marks forks in the tooltip but leaves authored repos unflagged', () => {
		const repos = [
			repo({ name: 'starred-fork', stars: 99, isFork: true }),
			repo({ name: 'big', stars: 50 })
		];
		const out = topRepos(repos, byKey('stars'), {});
		expect(out[0].rows).toContainEqual({ label: 'Type', value: 'Fork' });
		expect(out[1].rows?.some((row) => row.label === 'Type')).toBe(false);
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
		years,
		commitMonths: {},
		yearsCovered: years.length,
		totalYears: years.length
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

	it('reports active days as a share of the returned calendar', () => {
		const fact = find(funFacts(data, rhythm, languages), 'Active days');
		expect(fact?.value).toBe('78%');
		expect(fact?.hint).toBe('7 of 9 days, 24 contributions');
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

describe('topicCloud', () => {
	it('tallies topics across owned repos, dropping forks, sorted by count', () => {
		const repos = [
			repo({ topics: ['cli', 'rust'] }),
			repo({ topics: ['cli', 'web'] }),
			repo({ topics: ['cli'] }),
			repo({ topics: ['rust'], isFork: true })
		];
		const out = topicCloud(repos);
		expect(out[0]).toMatchObject({ label: 'cli', value: 3 });
		expect(out.find((word) => word.label === 'rust')?.value).toBe(1);
		expect(out.find((word) => word.label === 'web')?.value).toBe(1);
		expect(out[0].rows?.[0]).toEqual({ label: 'Repos', value: '3' });
	});

	it('caps the cloud at the limit and handles no topics', () => {
		expect(topicCloud([repo({}), repo({})])).toEqual([]);
		const many = [repo({ topics: ['a', 'b', 'c'] })];
		expect(topicCloud(many, 2)).toHaveLength(2);
	});
});

describe('topicCount', () => {
	it('counts distinct topics across owned repos, ignoring forks', () => {
		const repos = [
			repo({ topics: ['cli', 'rust'] }),
			repo({ topics: ['cli', 'web'] }),
			repo({ topics: ['only-fork'], isFork: true })
		];
		expect(topicCount(repos)).toBe(3);
	});
});

describe('licenseBreakdown', () => {
	it('buckets null as No license and rolls the tail', () => {
		const repos = [
			repo({ license: 'MIT' }),
			repo({ license: 'MIT' }),
			repo({ license: 'Apache-2.0' }),
			repo({ license: null })
		];
		const out = licenseBreakdown(repos);
		expect(out[0]).toMatchObject({ label: 'MIT', value: 2 });
		expect(out.find((slice) => slice.label === 'No license')?.value).toBe(1);
	});
});

describe('repoRecency', () => {
	afterEach(() => vi.useRealTimers());

	it('groups repos into ordered recency bands by last push', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-19T00:00:00Z'));
		const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
		const repos = [
			repo({ pushedAt: ago(10) }),
			repo({ pushedAt: ago(29) }),
			repo({ pushedAt: ago(100) }),
			repo({ pushedAt: ago(800) })
		];
		const out = repoRecency(repos);
		expect(out.map((slice) => [slice.label, slice.value])).toEqual([
			['Past month', 2],
			['Past 6 months', 1],
			['Over 2 years', 1]
		]);
		expect(out[0].rows?.[1]).toEqual({ label: 'Last push', value: 'Pushed within 30 days' });
	});
});

describe('projectLifecycles', () => {
	it('maps authored repos into valid spans, most starred first', () => {
		const repos = [
			repo({
				name: 'small',
				url: '/small',
				stars: 2,
				createdAt: '2021-01-01T00:00:00Z',
				pushedAt: '2022-01-01T00:00:00Z'
			}),
			repo({
				name: 'big',
				url: '/big',
				stars: 20,
				createdAt: '2020-01-01T00:00:00Z',
				pushedAt: '2024-01-01T00:00:00Z',
				language: { name: 'Go', color: '#00ADD8' }
			}),
			repo({ name: 'fork', isFork: true })
		];
		const out = projectLifecycles(repos);
		expect(out.rows.map((row) => row.name)).toEqual(['big', 'small']);
		expect(out.rows[0]).toMatchObject({
			url: '/big',
			stars: 20,
			language: 'Go',
			color: '#00ADD8'
		});
		expect(out.start).toBe(Date.parse('2020-01-01T00:00:00Z'));
		expect(out.end).toBe(Date.parse('2024-01-01T00:00:00Z'));
	});

	it('clamps pushes before creation and drops invalid creation dates', () => {
		const out = projectLifecycles([
			repo({
				name: 'clamped',
				createdAt: '2024-01-01T00:00:00Z',
				pushedAt: '2023-01-01T00:00:00Z'
			}),
			repo({ name: 'invalid', createdAt: 'nope' })
		]);
		expect(out.rows).toHaveLength(1);
		expect(out.rows[0].end).toBe(out.rows[0].start);
	});

	it('dims tracked gaps over three months while keeping shorter gaps active', () => {
		const start = Date.parse('2020-01-01T00:00:00Z');
		const end = Date.parse('2020-10-01T00:00:00Z');
		const segments = lifecycleSegments(start, end, ['2020-02-01', '2020-06-01', '2020-08-01']);
		expect(segments.map((segment) => segment.active)).toEqual([true, false, true]);
		// The active month itself stays lit, so the dim only covers the empty Mar to May run
		expect(segments[1]).toMatchObject({
			start: Date.parse('2020-03-01'),
			end: Date.parse('2020-06-01')
		});
	});

	it('keeps the creation month active even when its marker predates the exact created time', () => {
		const start = Date.parse('2023-03-15T00:00:00Z');
		const end = Date.parse('2023-10-01T00:00:00Z');
		const segments = lifecycleSegments(start, end, ['2023-03-01', '2023-08-01']);
		expect(segments[0]).toMatchObject({ start, active: true });
		expect(segments.map((segment) => segment.active)).toEqual([true, false, true]);
	});

	it('keeps org lifecycles solid when tracked activity is not supplied', () => {
		const start = Date.parse('2020-01-01T00:00:00Z');
		const end = Date.parse('2022-01-01T00:00:00Z');
		expect(lifecycleSegments(start, end)).toEqual([{ start, end, active: true }]);
	});

	it('returns an empty domain when there are no authored repos', () => {
		expect(projectLifecycles([repo({ isFork: true })])).toEqual({
			rows: [],
			start: 0,
			end: 0
		});
	});
});

describe('reposPerYear', () => {
	const ts = '01-01T00:00:00Z';
	const lang = (name: string, color: string | null, bytes: number) => ({ name, color, bytes });

	it('splits a multi-language repo by byte share, keeping bar totals at repo count', () => {
		const repos = [repo({ nameWithOwner: 'a/r', createdAt: `2020-${ts}` })];
		const map = { 'a/r': [lang('JS', '#f1e05a', 60), lang('CSS', '#563d7c', 40)] };
		const out = reposPerYear(repos, map);
		expect(out.bars[0].total).toBe(1);
		expect(out.bars[0].values.JS).toBeCloseTo(0.6);
		expect(out.bars[0].values.CSS).toBeCloseTo(0.4);
		// One series per language, biggest share first, real colour kept
		expect(out.series.map((entry) => entry.key)).toEqual(['JS', 'CSS']);
		expect(out.series[0].color).toBe('#f1e05a');
	});

	it('shows every language as its own series and fills gap years', () => {
		const repos = [
			repo({ nameWithOwner: 'a/x', createdAt: `2020-${ts}` }),
			repo({ nameWithOwner: 'a/y', createdAt: `2022-${ts}` })
		];
		const map = {
			'a/x': [lang('Go', '#00ADD8', 100)],
			'a/y': [lang('Rust', '#dea584', 100)]
		};
		const out = reposPerYear(repos, map);
		expect(out.bars.map((bar) => bar.label)).toEqual(['2020', '2021', '2022']);
		expect(out.bars[1].total).toBe(0);
		expect(out.series.map((entry) => entry.key).sort()).toEqual(['Go', 'Rust']);
	});

	it('falls back to the primary language, then a muted Other, without byte data', () => {
		const repos = [
			repo({
				nameWithOwner: 'a/p',
				createdAt: `2021-${ts}`,
				language: { name: 'Vue', color: '#41b883' }
			}),
			repo({ nameWithOwner: 'a/u', createdAt: `2021-${ts}`, language: null })
		];
		const out = reposPerYear(repos, {});
		expect(out.bars[0].values.Vue).toBe(1);
		expect(out.bars[0].values.Other).toBe(1);
		const other = out.series.find((entry) => entry.key === 'Other');
		expect(other?.color).toBe('var(--muted-foreground)');
	});

	it('excludes forks and returns nothing when no repos qualify', () => {
		expect(reposPerYear([repo({ isFork: true })], {})).toEqual({ bars: [], series: [] });
	});
});

describe('portfolioScatter', () => {
	const byKey = (key: string) => SCATTER_AXES.find((axis) => axis.key === key)!;

	it('plots the chosen axes per owned repo, dropping forks', () => {
		const repos = [
			repo({ name: 'a', stars: 5, forks: 2, language: { name: 'Go', color: '#0ad' } }),
			repo({ name: 'f', isFork: true })
		];
		const out = portfolioScatter(repos, byKey('created'), byKey('stars'));
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({ label: 'a', y: 5, r: 2, color: '#0ad' });
		// Tooltip leads with the y axis, x axis, then the forks size detail
		expect(out[0].rows?.map((row) => row.label)).toEqual(['Stars', 'Created', 'Forks', 'Language']);
	});

	it('reads a lazy axis from the loaded maps and dedupes a repeated axis', () => {
		const repos = [repo({ name: 'a', nameWithOwner: 'o/a', forks: 4 })];
		const maps = { stats: { 'o/a': { commits: 12 } as never } };
		const out = portfolioScatter(repos, byKey('forks'), byKey('commits'), maps);
		expect(out[0]).toMatchObject({ x: 4, y: 12 });
		// Forks is both the x axis and the size detail, so it lists once
		expect(out[0].rows?.filter((row) => row.label === 'Forks')).toHaveLength(1);
	});

	it('drops repos missing a selected lazy metric instead of plotting false zeroes', () => {
		const repos = [
			repo({ name: 'covered', nameWithOwner: 'o/covered' }),
			repo({ name: 'missing', nameWithOwner: 'o/missing' })
		];
		const maps = { stats: { 'o/covered': { commits: 12 } as never } };
		const out = portfolioScatter(repos, byKey('created'), byKey('commits'), maps);
		expect(out.map((point) => point.label)).toEqual(['covered']);
	});

	it('falls back to no colour when a repo has no language', () => {
		expect(portfolioScatter([repo({})], byKey('created'), byKey('stars'))[0].color).toBeUndefined();
	});
});

describe('issueFlow and prFlow', () => {
	const stats = (partial: Partial<Record<string, number>>) => ({ ...partial }) as never;

	it('sums open from the repo and closed from the lazy stats map, dropping forks', () => {
		const repos = [
			repo({ nameWithOwner: 'o/a', openIssues: 3 }),
			repo({ nameWithOwner: 'o/b', openIssues: 1 }),
			repo({ nameWithOwner: 'o/f', openIssues: 9, isFork: true })
		];
		const out = issueFlow(repos, {
			'o/a': stats({ closedIssues: 12 }),
			'o/b': stats({ closedIssues: 4 })
		});
		expect(out.total).toBe(20);
		expect(out.rate).toBe(80);
		expect(out.slices.map((slice) => [slice.label, slice.value])).toEqual([
			['Closed', 16],
			['Open', 4]
		]);
	});

	it('counts merged and closed PRs together as resolved', () => {
		const repos = [repo({ nameWithOwner: 'o/a', openPRs: 2 })];
		const out = prFlow(repos, { 'o/a': stats({ mergedPRs: 6, closedPRs: 2 }) });
		expect(out.total).toBe(10);
		expect(out.rate).toBe(80);
	});

	it('uses the same covered repos for both sides of a sampled rate', () => {
		const repos = [
			repo({ nameWithOwner: 'o/covered', openIssues: 2 }),
			repo({ nameWithOwner: 'o/missing', openIssues: 100 })
		];
		const out = issueFlow(repos, {
			'o/covered': stats({ closedIssues: 8 })
		});
		expect(out.total).toBe(10);
		expect(out.rate).toBe(80);
	});

	it('stays at a zero rate when there is nothing to resolve', () => {
		expect(issueFlow([repo({})], {}).rate).toBe(0);
		expect(prFlow([repo({})], {}).total).toBe(0);
	});
});
