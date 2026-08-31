import { applyView, defaultView } from '$lib/utils/sort-filter';
import { githubAvatar, paths } from '$lib/config';
import { formatNumber } from '$lib/utils/format';
import type { SortFilterConfig, View } from '$lib/utils/sort-filter';
import type {
	AuthoredContributions,
	AuthoredRepo,
	BarSegment,
	Slice,
	StackBar,
	StackSeries
} from '$lib/types';

// Repo rows shown in the overview panel before linking to the full page
export const CONTRIB_PANEL_ROWS = 25;
// External repos below this count keep the panel defaulting to all contributions
const MIN_EXTERNAL_REPOS = 3;

// PR and issue totals across a set of repos, for the year separator and list tally
export type ContribSummary = {
	prs: number;
	mergedPrs: number;
	closedPrs: number;
	issues: number;
	closedIssues: number;
};

// Sum a repo list into one contribution summary
export function summarize(repos: AuthoredRepo[]): ContribSummary {
	const total: ContribSummary = { prs: 0, mergedPrs: 0, closedPrs: 0, issues: 0, closedIssues: 0 };
	for (const repo of repos) {
		total.prs += repo.prs;
		total.mergedPrs += repo.mergedPrs;
		total.closedPrs += repo.closedPrs;
		total.issues += repo.issues;
		total.closedIssues += repo.closedIssues;
	}
	return total;
}

export type ContribYear = { year: number; repos: AuthoredRepo[]; summary: ContribSummary };

// Years with optional external-only and merged-only filters, empty years dropped, each summarised
export function contributionYears(
	data: AuthoredContributions,
	externalOnly: boolean,
	mergedOnly = false
): ContribYear[] {
	const years: ContribYear[] = [];
	for (const year of data.years) {
		const repos = year.repos.filter(
			(repo) => (!externalOnly || !repo.owned) && (!mergedOnly || repo.mergedPrs > 0)
		);
		if (repos.length) years.push({ year: year.year, repos, summary: summarize(repos) });
	}
	return years;
}

// Trim grouped years to at most maxRows repo rows total, re-summing any clipped year
export function capYears(years: ContribYear[], maxRows: number): ContribYear[] {
	const capped: ContribYear[] = [];
	let used = 0;
	for (const year of years) {
		if (used >= maxRows) break;
		const repos = year.repos.slice(0, maxRows - used);
		capped.push({ year: year.year, repos, summary: summarize(repos) });
		used += repos.length;
	}
	return capped;
}

// The capped year sections shown in the overview panel. The panel counts landed work only,
// so a repo the user opened PRs against but never got merged is not a contribution here
export function panelYears(data: AuthoredContributions, externalOnly: boolean): ContribYear[] {
	return capYears(contributionYears(data, externalOnly, true), CONTRIB_PANEL_ROWS);
}

// Whether the user has enough external work to open the panel on external by default.
// Counts the same merged-only repos the panel shows, so the default never opens on nothing
export function hasEnoughExternal(data: AuthoredContributions): boolean {
	const external = new Set<string>();
	for (const year of data.years) {
		for (const repo of year.repos) if (!repo.owned && repo.mergedPrs > 0) external.add(repo.repo);
	}
	return external.size >= MIN_EXTERNAL_REPOS;
}

// One repo owner (org or user) the contributions land on, totalled across every year
export type OwnerContribution = {
	owner: string;
	owned: boolean;
	prs: number;
	mergedPrs: number;
	issues: number;
	additions: number;
	deletions: number;
	repos: number;
};

// Contributions grouped by repo owner, biggest first. externalOnly drops the user's own
// namespace so the view reads as outward reach into other orgs and projects, and mergedOnly
// counts only repos where a PR actually landed
export function contributionOwners(
	data: AuthoredContributions,
	externalOnly: boolean,
	mergedOnly = false
): OwnerContribution[] {
	const byOwner = new Map<string, OwnerContribution>();
	for (const group of data.years) {
		for (const repo of group.repos) {
			if (externalOnly && repo.owned) continue;
			if (mergedOnly && !repo.mergedPrs) continue;
			const owner = repoOwner(repo.repo);
			let entry = byOwner.get(owner);
			if (!entry) {
				entry = {
					owner,
					owned: repo.owned,
					prs: 0,
					mergedPrs: 0,
					issues: 0,
					additions: 0,
					deletions: 0,
					repos: 0
				};
				byOwner.set(owner, entry);
			}
			entry.prs += repo.prs;
			entry.mergedPrs += repo.mergedPrs;
			entry.issues += repo.issues;
			entry.additions += repo.additions;
			entry.deletions += repo.deletions;
			entry.repos += 1;
		}
	}
	// Rank on whatever the caller is counting, so a capped list keeps the right owners
	const rank = (owner: OwnerContribution) => (mergedOnly ? owner.mergedPrs : owner.prs);
	return [...byOwner.values()].sort(
		(a, b) => rank(b) - rank(a) || b.issues - a.issues || a.owner.localeCompare(b.owner)
	);
}

const repoOwner = (repo: string) => repo.slice(0, repo.indexOf('/'));

export type ContribRow = AuthoredRepo & { year: number };

// One flat row per repo and year, for the full filterable list
export function contributionRows(data: AuthoredContributions): ContribRow[] {
	return data.years.flatMap((year) => year.repos.map((repo) => ({ ...repo, year: year.year })));
}

// Distinct years newest first, for the year filter options
function yearOptions(rows: ContribRow[]): { value: string; label: string }[] {
	return [...new Set(rows.map((row) => row.year))]
		.sort((a, b) => b - a)
		.map((year) => ({ value: String(year), label: String(year) }));
}

const churn = (row: ContribRow) => row.additions + row.deletions;

// What each activity filter counts, a row survives when its count is non-zero
const CONTRIB_METRICS: Record<string, { label: string; count: (row: ContribRow) => number }> = {
	'': { label: 'Contributions', count: (row) => row.prs + row.issues },
	merged: { label: 'Merged PRs', count: (row) => row.mergedPrs },
	prs: { label: 'Pull requests', count: (row) => row.prs },
	issues: { label: 'Issues', count: (row) => row.issues }
};

export const contribMetric = (activity: string) => CONTRIB_METRICS[activity] ?? CONTRIB_METRICS[''];

export const MERGED_ACTIVITY = 'merged';

// Sort, filter and search config for the full contributions list
export function contributionsConfig(rows: ContribRow[]): SortFilterConfig<ContribRow> {
	return {
		search: (row) => row.repo,
		sorts: [
			{ key: 'recent', label: 'Most recent', value: (row) => row.lastAt },
			{ key: 'diff', label: 'Largest diff', value: churn },
			{ key: 'merged', label: 'Most merged PRs', value: (row) => row.mergedPrs },
			{ key: 'prs', label: 'Most PRs', value: (row) => row.prs },
			{ key: 'issues', label: 'Most issues', value: (row) => row.issues },
			{ key: 'repo', label: 'Repository', value: (row) => row.repo }
		],
		filters: [
			{
				key: 'activity',
				label: 'Activity',
				options: [
					{ value: MERGED_ACTIVITY, label: 'Merged PRs' },
					{ value: 'prs', label: 'Pull requests' },
					{ value: 'issues', label: 'Issues' }
				],
				test: (row, value) => contribMetric(value).count(row) > 0
			},
			{
				key: 'year',
				label: 'Year',
				options: yearOptions(rows),
				test: (row, value) => String(row.year) === value
			},
			{
				key: 'scope',
				label: 'Repos',
				options: [
					{ value: 'external', label: 'External only' },
					{ value: 'owned', label: 'Own repos' }
				],
				test: (row, value) => (value === 'external' ? !row.owned : row.owned)
			}
		]
	};
}

// The filter state a fresh page starts on, held above every block that reads it
export const defaultContributionsView = (): View => defaultView(contributionsConfig([]));

// Lift the year filter, for the chart that always spans every year
export const acrossYears = (view: View): View => ({
	...view,
	filters: { ...view.filters, year: '' }
});

// The rows the list is currently showing
export function visibleContributions(data: AuthoredContributions, view: View): ContribRow[] {
	const rows = contributionRows(data);
	return applyView(rows, contributionsConfig(rows), view);
}

export type ContribTotals = ContribSummary & {
	repos: number;
	owners: number;
	additions: number;
	deletions: number;
	years: number[];
};

// Headline totals over a set of rows, repos and owners each counted once
export function contributionTotals(rows: ContribRow[]): ContribTotals {
	const repos = new Set<string>();
	const owners = new Set<string>();
	const years = new Set<number>();
	let additions = 0;
	let deletions = 0;
	for (const row of rows) {
		repos.add(row.repo);
		owners.add(repoOwner(row.repo));
		years.add(row.year);
		additions += row.additions;
		deletions += row.deletions;
	}
	return {
		...summarize(rows),
		repos: repos.size,
		owners: owners.size,
		additions,
		deletions,
		years: [...years].sort((a, b) => a - b)
	};
}

export const CONTRIB_YEAR_SERIES: StackSeries[] = [
	{
		key: 'merged',
		label: 'Merged PRs',
		color: 'var(--lifecycle-resolved)',
		hint: 'Pull requests that landed'
	},
	{
		key: 'closed',
		label: 'Closed PRs',
		color: 'var(--lifecycle-discarded)',
		hint: 'Pull requests closed without merging'
	},
	{
		key: 'open',
		label: 'Open PRs',
		color: 'var(--lifecycle-open)',
		hint: 'Pull requests still open'
	},
	{
		key: 'closedIssues',
		label: 'Closed issues',
		color: 'color-mix(in oklch, var(--info) 70%, var(--card))',
		hint: 'Issues opened and since closed'
	},
	{
		key: 'openIssues',
		label: 'Open issues',
		color: 'var(--info)',
		hint: 'Issues still open'
	}
];

// A summary split into the series above, the open counts being whatever is left over
const lifecycleValues = (sum: ContribSummary): Record<string, number> => ({
	merged: sum.mergedPrs,
	closed: sum.closedPrs,
	open: Math.max(0, sum.prs - sum.mergedPrs - sum.closedPrs),
	closedIssues: sum.closedIssues,
	openIssues: Math.max(0, sum.issues - sum.closedIssues)
});

// Which series make up each metric, so a bar only shows parts summing to its own length
const METRIC_PARTS: Record<string, string[]> = {
	'': ['merged', 'closed', 'open', 'closedIssues', 'openIssues'],
	prs: ['merged', 'closed', 'open'],
	issues: ['closedIssues', 'openIssues'],
	merged: []
};

// One bar per year, oldest first, with both kinds split by how they ended up
export function contributionYearBars(rows: ContribRow[]): StackBar[] {
	const byYear = new Map<number, ContribRow[]>();
	for (const row of rows) {
		const group = byYear.get(row.year);
		if (group) group.push(row);
		else byYear.set(row.year, [row]);
	}
	return [...byYear.entries()]
		.sort(([a], [b]) => a - b)
		.map(([year, group]) => {
			const sum = summarize(group);
			return {
				label: String(year),
				values: lifecycleValues(sum),
				total: sum.prs + sum.issues
			};
		});
}

// The non-empty parts of one summary under a metric, coloured to match the year chart
function metricSegments(activity: string, sum: ContribSummary): BarSegment[] {
	const values = lifecycleValues(sum);
	const parts = (METRIC_PARTS[activity] ?? METRIC_PARTS['']).flatMap(
		(key) => CONTRIB_YEAR_SERIES.find((series) => series.key === key) ?? []
	);
	const segments = parts
		.map((series) => ({ ...series, value: values[series.key] }))
		.filter((part) => part.value > 0);
	// A single part is the whole bar, so leave it as a plain one
	return segments.length > 1 ? segments : [];
}

// Repos ranked by whatever the activity filter counts, as bar rows linking to each repo
export function topContributionRepos(rows: ContribRow[], activity: string, limit: number): Slice[] {
	const { count } = contribMetric(activity);
	const byRepo = new Map<string, ContribSummary & { value: number }>();
	for (const row of rows) {
		let entry = byRepo.get(row.repo);
		if (!entry)
			byRepo.set(
				row.repo,
				(entry = { value: 0, prs: 0, mergedPrs: 0, closedPrs: 0, issues: 0, closedIssues: 0 })
			);
		entry.value += count(row);
		entry.prs += row.prs;
		entry.mergedPrs += row.mergedPrs;
		entry.closedPrs += row.closedPrs;
		entry.issues += row.issues;
		entry.closedIssues += row.closedIssues;
	}
	return [...byRepo.entries()]
		.filter(([, entry]) => entry.value > 0)
		.sort(
			([leftRepo, left], [rightRepo, right]) =>
				right.value - left.value || leftRepo.localeCompare(rightRepo)
		)
		.slice(0, limit)
		.map(([repo, entry]) => {
			const owner = repoOwner(repo);
			const segments = metricSegments(activity, entry);
			return {
				label: repo,
				value: entry.value,
				icon: githubAvatar(owner, 32),
				href: paths.repo(owner, repo.slice(owner.length + 1)),
				segments,
				rows: segments.length
					? [
							...segments.map((part) => ({
								label: part.label,
								value: formatNumber(part.value),
								color: part.color
							})),
							{ label: 'Total', value: formatNumber(entry.value) }
						]
					: undefined
			};
		});
}
