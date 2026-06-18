import { formatNumber, formatSize, formatDate, relativeTime } from '$lib/format';
import { DAYS_FULL, toMondayFirst } from '$lib/datetime';
import type {
	ActivityRhythm,
	ContributionDay,
	ContributionTotals,
	LanguageUsage,
	Repo,
	UserContributions,
	YearCalendar
} from '$lib/types';

// One detail line inside a chart tooltip
export type TipRow = { label: string; value: string; color?: string };
// Tooltip contents for a single chart element
export type TipData = { title: string; color?: string; rows: TipRow[] };

// A chart datum, rows override the default tooltip detail when present
export type Slice = { label: string; value: number; color?: string; rows?: TipRow[] };
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

// Most-starred owned repos, tooltip carries forks, language and recency
export function topRepos(repos: Repo[], limit = 8): Slice[] {
	return authored(repos)
		.filter((repo) => repo.stars > 0)
		.sort((first, second) => second.stars - first.stars)
		.slice(0, limit)
		.map((repo) => ({
			label: repo.name,
			value: repo.stars,
			rows: [
				{ label: 'Stars', value: formatNumber(repo.stars) },
				{ label: 'Forks', value: formatNumber(repo.forks) },
				{ label: 'Language', value: repo.language?.name ?? 'n/a' },
				{ label: 'Updated', value: relativeTime(repo.pushedAt) }
			]
		}));
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

// Drop near-empty years from the calendar, but only once a busy year exists,
// so light accounts still see their full history
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

// Every calendar day mapped to its count, deduping the days GitHub repeats at
// year boundaries, so the dates form one continuous run for streak counting
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
