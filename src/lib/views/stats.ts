import { formatNumber, formatSize, formatDate, relativeTime } from '$lib/format';
import { DAYS_FULL, toMondayFirst } from '$lib/datetime';
import type {
	ActivityRhythm,
	ContributionDay,
	ContributionTotals,
	LanguageUsage,
	Repo,
	RepoActivityMonths,
	RepoLang,
	RepoStats,
	UserContributions,
	YearCalendar
} from '$lib/types';

// One detail line inside a chart tooltip
export type TipRow = { label: string; value: string; color?: string };
// Tooltip contents for a single chart element
export type TipData = { title: string; color?: string; rows: TipRow[] };

// A chart datum, rows override the default tooltip detail when present
export type Slice = { label: string; value: number; color?: string; rows?: TipRow[] };
// One scatter dot: x/y plot position, r drives the dot size, rows feed the tooltip
export type ScatterPoint = {
	label: string;
	x: number;
	y: number;
	r: number;
	color?: string;
	rows?: TipRow[];
};
export type LevelDay = ContributionDay & { level: number };

// One coloured series in a stacked bar, keyed to a StackBar's values
export type StackSeries = { key: string; label: string; color: string };
// One stacked bar: a value per series key, plus the column total
export type StackBar = { label: string; values: Record<string, number>; total: number };

// Contribution kinds in stacking order, colours match the by-type donut
export const CONTRIBUTION_SERIES: StackSeries[] = [
	{ key: 'commits', label: 'Commits', color: 'var(--chart-1)' },
	{ key: 'prs', label: 'Pull requests', color: 'var(--chart-2)' },
	{ key: 'issues', label: 'Issues', color: 'var(--chart-3)' },
	{ key: 'reviews', label: 'Reviews', color: 'var(--chart-4)' },
	{ key: 'restricted', label: 'Private', color: 'var(--chart-5)' },
	{ key: 'other', label: 'Other', color: 'var(--muted-foreground)' }
];

// Owned repos that count toward a user's footprint, forks add noise so drop them
function authored(repos: Repo[]): Repo[] {
	return repos.filter((repo) => !repo.isFork);
}

// Keep authored repos and forks which grew their own audience
function notable(repos: Repo[]): Repo[] {
	return repos.filter((repo) => !repo.isFork || repo.stars > 0);
}

// Owned source repos and their combined star count, for the summary strip
export function repoTotals(repos: Repo[]) {
	const owned = authored(repos);
	return {
		repos: owned.length,
		stars: owned.reduce((total, repo) => total + repo.stars, 0)
	};
}

// Collapse the long tail past limit into a single "Other" slice
function rollUp(slices: Slice[], limit: number): Slice[] {
	if (slices.length <= limit) return slices;
	const head = slices.slice(0, limit - 1);
	const rest = slices.slice(limit - 1);
	const value = rest.reduce((total, slice) => total + slice.value, 0);
	return value > 0 ? [...head, { label: `Other (${rest.length})`, value }] : head;
}

// Languages by total bytes across the user's repos, with byte and repo detail
export function languageBreakdown(usage: LanguageUsage[], limit = 8): Slice[] {
	const total = usage.reduce((sum, language) => sum + language.bytes, 0) || 1;
	const slices = usage.map((language) => ({
		label: language.name,
		value: language.bytes,
		color: language.color ?? undefined,
		rows: [
			{ label: 'Code', value: formatSize(language.bytes / 1024) },
			{ label: 'Share', value: `${Math.round((language.bytes / total) * 100)}%` },
			{ label: 'Repos', value: formatNumber(language.repos) }
		]
	}));
	return rollUp(slices, limit);
}

// Lazily loaded per-repo maps that the heavier metrics rank by, keyed by nameWithOwner
export type MetricMaps = {
	stats?: Record<string, RepoStats>;
	contributors?: Record<string, number>;
};
type MetricInput = { stats?: RepoStats; contributors?: number };

// Ways to rank owned repos. Cheap metrics read the repo, lazy ones read the maps
export type RepoMetric = {
	key: string;
	label: string;
	short: string;
	lazy?: boolean;
	value: (repo: Repo, data: MetricInput) => number;
	format?: (value: number) => string;
};

export const REPO_METRICS: RepoMetric[] = [
	{ key: 'stars', label: 'Most starred repos', short: 'Stars', value: (repo) => repo.stars },
	{ key: 'forks', label: 'Most forked repos', short: 'Forks', value: (repo) => repo.forks },
	{
		key: 'watchers',
		label: 'Most watched repos',
		short: 'Watchers',
		value: (repo) => repo.watchers
	},
	{
		key: 'size',
		label: 'Largest repos',
		short: 'Size',
		value: (repo) => repo.diskUsage,
		format: formatSize
	},
	{
		key: 'open',
		label: 'Most open issues and PRs',
		short: 'Open issues + PRs',
		value: (repo) => repo.openIssues + repo.openPRs
	},
	{
		key: 'issues',
		label: 'Most open issues',
		short: 'Open issues',
		value: (repo) => repo.openIssues
	},
	{ key: 'prs', label: 'Most open PRs', short: 'Open PRs', value: (repo) => repo.openPRs },
	{
		key: 'commits',
		label: 'Most commits',
		short: 'Commits',
		lazy: true,
		value: (_repo, data) => data.stats?.commits ?? 0
	},
	{
		key: 'contributors',
		label: 'Most contributors',
		short: 'Contributors',
		lazy: true,
		value: (_repo, data) => data.contributors ?? 0
	},
	{
		key: 'mergedPRs',
		label: 'Most merged PRs',
		short: 'Merged PRs',
		lazy: true,
		value: (_repo, data) => data.stats?.mergedPRs ?? 0
	},
	{
		key: 'closedIssues',
		label: 'Most closed issues',
		short: 'Closed issues',
		lazy: true,
		value: (_repo, data) => data.stats?.closedIssues ?? 0
	},
	{
		key: 'releases',
		label: 'Most releases',
		short: 'Releases',
		lazy: true,
		value: (_repo, data) => data.stats?.releaseCount ?? 0
	}
];

// Top owned repos for a metric, tooltip carries the metric, language and recency
export function topRepos(repos: Repo[], metric: RepoMetric, maps: MetricMaps, limit = 10): Slice[] {
	const show = metric.format ?? formatNumber;
	const valueOf = (repo: Repo) =>
		metric.value(repo, {
			stats: maps.stats?.[repo.nameWithOwner],
			contributors: maps.contributors?.[repo.nameWithOwner]
		});
	return notable(repos)
		.map((repo) => ({ repo, value: valueOf(repo) }))
		.filter((entry) => entry.value > 0)
		.sort((first, second) => second.value - first.value)
		.slice(0, limit)
		.map(({ repo, value }) => ({
			label: repo.name,
			value,
			rows: [
				{ label: metric.short, value: show(value) },
				{ label: 'Language', value: repo.language?.name ?? 'n/a' },
				{ label: 'Updated', value: relativeTime(repo.pushedAt) },
				...(repo.isFork ? [{ label: 'Type', value: 'Fork' }] : [])
			]
		}));
}

// Per-repo cumulative stars on a shared day axis, top repos plus an Other band
export type StarSeries = { label: string; values: number[] };
export type StarBreakdown = {
	days: string[];
	series: StarSeries[];
	coveredRepos?: number;
	totalRepos?: number;
};
// Trimmed to the visible range, with the running total per day
export type StarStack = StarBreakdown & { total: number[] };

// Big accounts skip the slow early tail and begin at 1% of their current total
const MILESTONE_MIN = 10000;

function milestoneStart(total: number[]): number {
	const current = total.at(-1) ?? 0;
	if (current <= MILESTONE_MIN) return 0;
	const start = total.findIndex((value) => value >= current * 0.01);
	return start < 0 ? 0 : start;
}

// Stacked star history trimmed to its visible range, carrying the per-day total
export function starHistory({ days, series }: StarBreakdown): StarStack {
	const total = days.map((_, index) => series.reduce((sum, item) => sum + item.values[index], 0));
	const start = milestoneStart(total);
	return {
		days: days.slice(start),
		series: series.map((item) => ({ ...item, values: item.values.slice(start) })),
		total: total.slice(start)
	};
}

// Bucket each day into one of five intensity levels off the busiest day
export function contributionLevels(days: ContributionDay[]): LevelDay[] {
	const max = days.reduce((peak, day) => Math.max(peak, day.count), 0);
	return days.map((day) => ({ ...day, level: levelFor(day.count, max) }));
}

function levelFor(count: number, max: number): number {
	if (count === 0 || max === 0) return 0;
	return Math.min(4, Math.ceil((count / max) * 4));
}

// A year needs at least this many contributions to keep its own calendar
const YEAR_MIN_CONTRIBUTIONS = 100;

// Hide near-empty years only when the account has busier history
export function visibleContributionYears(years: YearCalendar[]): YearCalendar[] {
	const hasBusyYear = years.some((year) => year.total > YEAR_MIN_CONTRIBUTIONS);
	if (!hasBusyYear) return years;
	return years.filter((year) => year.total >= YEAR_MIN_CONTRIBUTIONS);
}

// Split totals into labelled slices, dropping kinds with no contributions
export function contributionTypes(totals: ContributionTotals): Slice[] {
	return [
		{ label: 'Commits', value: totals.commits },
		{ label: 'Pull requests', value: totals.prs },
		{ label: 'Issues', value: totals.issues },
		{ label: 'Reviews', value: totals.reviews },
		{ label: 'Private', value: totals.restricted }
	].filter((slice) => slice.value > 0);
}

// One headline fact tile, hint carries the supporting detail on hover
export type Fact = { label: string; value: string; hint: string };
type Streak = { length: number; start: string; end: string };

// Dedupe boundary dates into one continuous calendar
function dailyCounts(years: YearCalendar[]): Map<string, number> {
	const byDate = new Map<string, number>();
	for (const year of years) {
		for (const day of year.days) byDate.set(day.date, day.count);
	}
	return byDate;
}

// Longest all-time run and the run ending today, tolerating a still-empty today
function streaks(byDate: Map<string, number>): { current: Streak; longest: Streak } {
	const dates = [...byDate.keys()].sort();
	let longest: Streak = { length: 0, start: '', end: '' };
	let run = 0;
	let runStart = '';
	for (const date of dates) {
		if ((byDate.get(date) ?? 0) > 0) {
			if (run === 0) runStart = date;
			run += 1;
			if (run > longest.length) longest = { length: run, start: runStart, end: date };
		} else {
			run = 0;
		}
	}
	let index = dates.length - 1;
	if (index >= 0 && (byDate.get(dates[index]) ?? 0) === 0) index -= 1;
	const current: Streak = { length: 0, start: '', end: '' };
	while (index >= 0 && (byDate.get(dates[index]) ?? 0) > 0) {
		if (!current.end) current.end = dates[index];
		current.start = dates[index];
		current.length += 1;
		index -= 1;
	}
	return { current, longest };
}

// Argmax over an index/count map, returning the leading index and its count
function peakIndex(totals: number[]): { index: number; count: number } {
	let index = 0;
	totals.forEach((count, at) => {
		if (count > totals[index]) index = at;
	});
	return { index, count: totals[index] };
}

// Weekday with the most contributions all-time, Monday-first
function busiestWeekday(byDate: Map<string, number>): { day: number; count: number } {
	const totals = new Array(7).fill(0);
	for (const [date, count] of byDate) {
		totals[toMondayFirst(new Date(`${date}T00:00:00Z`).getUTCDay())] += count;
	}
	const peak = peakIndex(totals);
	return { day: peak.index, count: peak.count };
}

// Hour of day with the most tracked activity, summed across weekdays
function busiestHour(punch: number[][]): { hour: number; count: number } {
	const totals = new Array(24).fill(0);
	for (const row of punch) row.forEach((count, hour) => (totals[hour] += count));
	const peak = peakIndex(totals);
	return { hour: peak.index, count: peak.count };
}

// The single day with the most contributions
function biggestDay(byDate: Map<string, number>): { date: string; count: number } {
	let best = { date: '', count: 0 };
	for (const [date, count] of byDate) {
		if (count > best.count) best = { date, count };
	}
	return best;
}

const dayCount = (length: number) => `${formatNumber(length)} ${length === 1 ? 'day' : 'days'}`;

// Headline trivia derived from data already loaded, each with a detail hint
export function funFacts(
	contributions: UserContributions,
	rhythm: ActivityRhythm | null,
	languages: LanguageUsage[]
): Fact[] {
	const byDate = dailyCounts(contributions.years);
	if (!byDate.size) return [];
	const facts: Fact[] = [];

	const { current, longest } = streaks(byDate);
	const activeDays = [...byDate.values()].filter((count) => count > 0).length;
	facts.push({
		label: 'Active days',
		value: `${Math.round((activeDays / byDate.size) * 100)}%`,
		hint: `${formatNumber(activeDays)} of ${formatNumber(byDate.size)} days, ${formatNumber(contributions.total)} contributions`
	});
	facts.push({
		label: 'Current streak',
		value: dayCount(current.length),
		hint: current.length
			? `${formatDate(current.start)} to ${formatDate(current.end)}`
			: 'No active streak right now'
	});
	facts.push({
		label: 'Longest streak',
		value: dayCount(longest.length),
		hint: longest.length
			? `${formatDate(longest.start)} to ${formatDate(longest.end)}`
			: 'No contributions yet'
	});

	const weekday = busiestWeekday(byDate);
	facts.push({
		label: 'Busiest day',
		value: DAYS_FULL[weekday.day],
		hint: `${formatNumber(weekday.count)} contributions on ${DAYS_FULL[weekday.day]}s`
	});

	if (rhythm && rhythm.total > 0) {
		const { hour, count } = busiestHour(rhythm.punch);
		const slot = `${String(hour).padStart(2, '0')}:00`;
		facts.push({
			label: 'Peak hour',
			value: `${slot} UTC`,
			hint: `${formatNumber(count)} tracked actions around ${slot} UTC`
		});
	}

	const top = languages[0];
	if (top) {
		const bytes = languages.reduce((sum, language) => sum + language.bytes, 0) || 1;
		const share = Math.round((top.bytes / bytes) * 100);
		facts.push({
			label: 'Top language',
			value: top.name,
			hint: `${share}% of code, ${formatSize(top.bytes / 1024)} across ${formatNumber(top.repos)} repos`
		});
	}

	const best = contributions.years.reduce<YearCalendar | null>(
		(winner, year) => (!winner || year.total > winner.total ? year : winner),
		null
	);
	if (best && best.total > 0) {
		facts.push({
			label: 'Best year',
			value: String(best.year),
			hint: `${formatNumber(best.total)} contributions in ${best.year}`
		});
	}

	const big = biggestDay(byDate);
	if (big.count > 0) {
		facts.push({
			label: 'Biggest day',
			value: formatNumber(big.count),
			hint: `${formatNumber(big.count)} contributions on ${formatDate(big.date)}`
		});
	}

	return facts;
}

// Per-year stacked bars split by kind, with Other for untyped calendar entries
export function contributionsPerYear(years: YearCalendar[]): StackBar[] {
	return [...years]
		.sort((first, second) => first.year - second.year)
		.map((year) => {
			const known = year.commits + year.prs + year.issues + year.reviews + year.restricted;
			const other = Math.max(0, year.total - known);
			return {
				label: String(year.year),
				total: known + other,
				values: {
					commits: year.commits,
					prs: year.prs,
					issues: year.issues,
					reviews: year.reviews,
					restricted: year.restricted,
					other
				}
			};
		});
}

export type YearLanguageBars = { bars: StackBar[]; series: StackSeries[] };

// Distinct fallbacks for languages GitHub gives no colour, untyped repos stay muted
const FALLBACK_COLORS = [
	'var(--chart-1)',
	'var(--chart-2)',
	'var(--chart-3)',
	'var(--chart-4)',
	'var(--chart-5)'
];
const NO_LANGUAGE = 'Other';

// Split one repo across languages, falling back to its primary language
function repoShares(
	repo: Repo,
	repoLangs: Record<string, RepoLang[]>
): [name: string, color: string | null, share: number][] {
	const langs = repoLangs[repo.nameWithOwner] ?? [];
	const totalBytes = langs.reduce((sum, lang) => sum + lang.bytes, 0);
	if (totalBytes > 0) {
		return langs.map((lang) => [lang.name, lang.color, lang.bytes / totalBytes]);
	}
	if (repo.language) return [[repo.language.name, repo.language.color, 1]];
	return [[NO_LANGUAGE, 'var(--muted-foreground)', 1]];
}

// Bucket authored repos by year and split each one across its languages
export function reposPerYear(
	repos: Repo[],
	repoLangs: Record<string, RepoLang[]>
): YearLanguageBars {
	const owned = authored(repos);
	if (!owned.length) return { bars: [], series: [] };

	// Total repo-share and first-seen colour per language, to rank and colour series
	const totals = new Map<string, number>();
	const colors = new Map<string, string | null>();
	const byYear = new Map<number, StackBar>();

	for (const repo of owned) {
		const year = new Date(repo.createdAt).getUTCFullYear();
		let bar = byYear.get(year);
		if (!bar) {
			bar = { label: String(year), values: {}, total: 0 };
			byYear.set(year, bar);
		}
		bar.total += 1;
		for (const [name, color, share] of repoShares(repo, repoLangs)) {
			if (!colors.has(name)) colors.set(name, color);
			totals.set(name, (totals.get(name) ?? 0) + share);
			bar.values[name] = (bar.values[name] ?? 0) + share;
		}
	}

	// Every language as its own series, biggest first so it anchors the stack
	let fallback = 0;
	const series: StackSeries[] = [...totals.entries()]
		.sort((first, second) => second[1] - first[1])
		.map(([name]) => ({
			key: name,
			label: name,
			color: colors.get(name) ?? FALLBACK_COLORS[fallback++ % FALLBACK_COLORS.length]
		}));

	// Fill gap years with empty bars so adjacent bars are never years apart
	const years = [...byYear.keys()];
	const bars: StackBar[] = [];
	for (let year = Math.min(...years); year <= Math.max(...years); year += 1) {
		bars.push(byYear.get(year) ?? { label: String(year), values: {}, total: 0 });
	}
	return { bars, series };
}

// Most common repo topics across owned repos, sized later by their repo count
export function topicCloud(repos: Repo[], limit = 40): Slice[] {
	const counts = new Map<string, number>();
	for (const repo of authored(repos)) {
		for (const topic of repo.topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((first, second) => second[1] - first[1])
		.slice(0, limit)
		.map(([label, value]) => ({
			label,
			value,
			rows: [{ label: 'Repos', value: formatNumber(value) }]
		}));
}

// Distinct topic count across owned repos, so the cloud can flag any it trims
export function topicCount(repos: Repo[]): number {
	const seen = new Set<string>();
	for (const repo of authored(repos)) for (const topic of repo.topics) seen.add(topic);
	return seen.size;
}

// How owned repos are licensed, unlicensed repos collapse into one bucket
export function licenseBreakdown(repos: Repo[], limit = 8): Slice[] {
	const counts = new Map<string, number>();
	for (const repo of authored(repos)) {
		const key = repo.license ?? 'No license';
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const slices = [...counts.entries()]
		.sort((first, second) => second[1] - first[1])
		.map(([label, value]) => ({ label, value }));
	return rollUp(slices, limit);
}

// Recency bands by days since the last push, freshest first, labels self-explain
const RECENCY_BANDS = [
	{ label: 'Past month', maxDays: 30, hint: 'Pushed within 30 days' },
	{ label: 'Past 6 months', maxDays: 182, hint: 'Pushed 1 to 6 months ago' },
	{ label: 'Past 2 years', maxDays: 730, hint: 'Pushed 6 months to 2 years ago' },
	{ label: 'Over 2 years', maxDays: Infinity, hint: 'Pushed over 2 years ago' }
];

// Owned repos grouped by how recently they were pushed to, empty bands dropped
export function repoRecency(repos: Repo[]): Slice[] {
	const now = Date.now();
	const counts = new Array(RECENCY_BANDS.length).fill(0);
	for (const repo of authored(repos)) {
		const days = (now - Date.parse(repo.pushedAt)) / 86400000;
		counts[RECENCY_BANDS.findIndex((band) => days < band.maxDays)] += 1;
	}
	return RECENCY_BANDS.map((band, index) => ({
		label: band.label,
		value: counts[index],
		rows: [
			{ label: 'Repos', value: formatNumber(counts[index]) },
			{ label: 'Last push', value: band.hint }
		]
	})).filter((slice) => slice.value > 0);
}

export type LifecycleRow = {
	name: string;
	url: string;
	createdAt: string;
	pushedAt: string;
	start: number;
	end: number;
	stars: number;
	language: string;
	color?: string;
	archived: boolean;
	segments: LifecycleSegment[];
};

export type LifecycleSegment = { start: number; end: number; active: boolean };
export type LifecycleData = { rows: LifecycleRow[]; start: number; end: number };

export const LIFECYCLE_GAP_MONTHS = 3;

const monthFloor = (time: number) => {
	const date = new Date(time);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
};
const nextMonth = (time: number) => {
	const date = new Date(time);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
};
const monthStamp = (time: number) => `${new Date(time).toISOString().slice(0, 7)}-01`;

// Walk the repo's months, dimming long quiet runs (the creation month counts as active)
export function lifecycleSegments(
	start: number,
	end: number,
	months?: string[]
): LifecycleSegment[] {
	if (!months) return [{ start, end, active: true }];
	const active = new Set(months);
	const flags: LifecycleSegment[] = [];
	for (let month = monthFloor(start); month <= end; month = nextMonth(month)) {
		const from = Math.max(start, month);
		const to = Math.min(end, nextMonth(month));
		if (to > from) flags.push({ start: from, end: to, active: active.has(monthStamp(month)) });
	}
	if (!flags.length) return [{ start, end, active: true }];

	// A quiet run only dims once it reaches the gap, shorter pauses stay active
	for (let index = 0; index < flags.length; ) {
		if (flags[index].active) {
			index++;
			continue;
		}
		let until = index;
		while (until < flags.length && !flags[until].active) until++;
		if (until - index < LIFECYCLE_GAP_MONTHS)
			for (let quiet = index; quiet < until; quiet++) flags[quiet].active = true;
		index = until;
	}

	// Merge neighbouring months that share a state into one segment
	const segments: LifecycleSegment[] = [];
	for (const flag of flags) {
		const previous = segments.at(-1);
		if (previous?.active === flag.active) previous.end = flag.end;
		else segments.push(flag);
	}
	return segments;
}

// Turn authored repos into creation-to-last-push spans, most starred first
export function projectLifecycles(repos: Repo[], activity?: RepoActivityMonths): LifecycleData {
	const rows = authored(repos)
		.map((repo): LifecycleRow | null => {
			const start = Date.parse(repo.createdAt);
			const pushed = Date.parse(repo.pushedAt);
			if (!Number.isFinite(start)) return null;
			const end = Number.isFinite(pushed) ? Math.max(start, pushed) : start;
			return {
				name: repo.name,
				url: repo.url,
				createdAt: repo.createdAt,
				pushedAt: Number.isFinite(pushed) ? repo.pushedAt : repo.createdAt,
				start,
				end,
				stars: repo.stars,
				language: repo.language?.name ?? 'Other',
				color: repo.language?.color ?? undefined,
				archived: repo.isArchived,
				segments: lifecycleSegments(start, end, activity?.[repo.nameWithOwner.toLowerCase()])
			};
		})
		.filter((row): row is LifecycleRow => !!row)
		.sort((first, second) => second.stars - first.stars || second.end - first.end);
	if (!rows.length) return { rows: [], start: 0, end: 0 };
	return {
		rows,
		start: Math.min(...rows.map((row) => row.start)),
		end: Math.max(...rows.map((row) => row.end))
	};
}

// An axis the portfolio scatter can plot, lazy axes read the loaded metric maps
export type ScatterAxis = {
	key: string;
	label: string;
	time?: boolean;
	lazy?: boolean;
	format?: (value: number) => string;
	value: (repo: Repo, data: MetricInput) => number;
};

export const SCATTER_AXES: ScatterAxis[] = [
	{ key: 'created', label: 'Created', time: true, value: (repo) => Date.parse(repo.createdAt) },
	{ key: 'pushed', label: 'Last push', time: true, value: (repo) => Date.parse(repo.pushedAt) },
	{ key: 'stars', label: 'Stars', value: (repo) => repo.stars },
	{ key: 'forks', label: 'Forks', value: (repo) => repo.forks },
	{ key: 'watchers', label: 'Watchers', value: (repo) => repo.watchers },
	{ key: 'size', label: 'Size', format: formatSize, value: (repo) => repo.diskUsage },
	{ key: 'open', label: 'Open issues + PRs', value: (repo) => repo.openIssues + repo.openPRs },
	{
		key: 'commits',
		label: 'Commits',
		lazy: true,
		value: (_repo, data) => data.stats?.commits ?? 0
	},
	{
		key: 'contributors',
		label: 'Contributors',
		lazy: true,
		value: (_repo, data) => data.contributors ?? 0
	},
	{
		key: 'mergedPRs',
		label: 'Merged PRs',
		lazy: true,
		value: (_repo, data) => data.stats?.mergedPRs ?? 0
	}
];

// Format an axis value for a tooltip, dates read as a day, metrics as numbers
function axisDisplay(axis: ScatterAxis, value: number): string {
	if (axis.time) return formatDate(new Date(value).toISOString());
	return (axis.format ?? formatNumber)(value);
}

// Owned repos as scatter dots on a chosen pair of axes, forks driving the dot size
export function portfolioScatter(
	repos: Repo[],
	xAxis: ScatterAxis,
	yAxis: ScatterAxis,
	maps: MetricMaps = {}
): ScatterPoint[] {
	const hasValue = (repo: Repo, axis: ScatterAxis) => {
		if (!axis.lazy) return true;
		return axis.key === 'contributors'
			? maps.contributors?.[repo.nameWithOwner] !== undefined
			: maps.stats?.[repo.nameWithOwner] !== undefined;
	};
	return authored(repos)
		.filter((repo) => hasValue(repo, xAxis) && hasValue(repo, yAxis))
		.map((repo) => {
			const input = {
				stats: maps.stats?.[repo.nameWithOwner],
				contributors: maps.contributors?.[repo.nameWithOwner]
			};
			const x = xAxis.value(repo, input);
			const y = yAxis.value(repo, input);
			const rows: TipRow[] = [];
			const seen = new Set<string>();
			// Dedupe so a repeated axis or the forks size detail only lists once
			const add = (label: string, value: string) => {
				if (seen.has(label)) return;
				seen.add(label);
				rows.push({ label, value });
			};
			add(yAxis.label, axisDisplay(yAxis, y));
			add(xAxis.label, axisDisplay(xAxis, x));
			add('Forks', formatNumber(repo.forks));
			add('Language', repo.language?.name ?? 'n/a');
			return {
				label: repo.name,
				x,
				y,
				r: repo.forks,
				color: repo.language?.color ?? undefined,
				rows
			};
		});
}

// Open vs closed split for the resolution gauges, with the closed share up front
export type FlowStat = { slices: Slice[]; total: number; rate: number };

// Two slices sharing one whole, coloured by domain state, closed leads the arc
function flow(open: number, closed: number): FlowStat {
	const total = open + closed;
	const rate = total ? Math.round((closed / total) * 100) : 0;
	const slice = (label: string, value: number, color: string, share: number): Slice => ({
		label,
		value,
		color,
		rows: [
			{ label, value: formatNumber(value) },
			{ label: 'Share', value: `${share}%` }
		]
	});
	return {
		total,
		rate,
		slices: [
			slice('Closed', closed, 'var(--merged)', rate),
			slice('Open', open, 'var(--open)', 100 - rate)
		]
	};
}

// Open vs closed issues across owned repos, closed counts come from the lazy map
export function issueFlow(repos: Repo[], stats: Record<string, RepoStats>): FlowStat {
	let open = 0;
	let closed = 0;
	for (const repo of authored(repos).filter((repo) => stats[repo.nameWithOwner])) {
		open += repo.openIssues;
		closed += stats[repo.nameWithOwner].closedIssues;
	}
	return flow(open, closed);
}

// Open vs resolved PRs across owned repos, resolved being merged plus closed
export function prFlow(repos: Repo[], stats: Record<string, RepoStats>): FlowStat {
	let open = 0;
	let closed = 0;
	for (const repo of authored(repos).filter((repo) => stats[repo.nameWithOwner])) {
		open += repo.openPRs;
		const entry = stats[repo.nameWithOwner];
		closed += entry.mergedPRs + entry.closedPRs;
	}
	return flow(open, closed);
}
