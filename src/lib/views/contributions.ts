import type { AuthoredContributions, AuthoredRepo } from '$lib/types';
import type { SortFilterConfig } from '$lib/utils/sort-filter';

// Repo rows shown in the overview panel before linking to the full page
export const CONTRIB_PANEL_ROWS = 25;
// External repos below this count keep the panel defaulting to all contributions
const MIN_EXTERNAL_REPOS = 3;

// Merged PR and issue totals across a set of repos, for the year separator
export type ContribSummary = { mergedPrs: number; issues: number };

// Sum a repo list into one contribution summary
export function summarize(repos: AuthoredRepo[]): ContribSummary {
	const total: ContribSummary = { mergedPrs: 0, issues: 0 };
	for (const repo of repos) {
		total.mergedPrs += repo.mergedPrs;
		total.issues += repo.issues;
	}
	return total;
}

export type ContribYear = { year: number; repos: AuthoredRepo[]; summary: ContribSummary };

// Years with an optional external-only filter, empty years dropped, each with its summary
export function contributionYears(
	data: AuthoredContributions,
	externalOnly: boolean
): ContribYear[] {
	const years: ContribYear[] = [];
	for (const year of data.years) {
		const repos = externalOnly ? year.repos.filter((repo) => !repo.owned) : year.repos;
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

// The capped year sections shown in the overview panel, with the external filter applied
export function panelYears(data: AuthoredContributions, externalOnly: boolean): ContribYear[] {
	return capYears(contributionYears(data, externalOnly), CONTRIB_PANEL_ROWS);
}

// Whether the user has enough external work to open the panel on external by default
export function hasEnoughExternal(data: AuthoredContributions): boolean {
	const external = new Set<string>();
	for (const year of data.years) {
		for (const repo of year.repos) if (!repo.owned) external.add(repo.repo);
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

// Contributions grouped by repo owner, most PRs first. externalOnly drops the user's own
// namespace so the view reads as outward reach into other orgs and projects, and an optional
// year narrows it to a single year
export function contributionOwners(
	data: AuthoredContributions,
	externalOnly: boolean,
	year: number | null = null
): OwnerContribution[] {
	const byOwner = new Map<string, OwnerContribution>();
	for (const group of data.years) {
		if (year !== null && group.year !== year) continue;
		for (const repo of group.repos) {
			if (externalOnly && repo.owned) continue;
			const owner = repo.repo.slice(0, repo.repo.indexOf('/'));
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
	return [...byOwner.values()].sort(
		(a, b) => b.prs - a.prs || b.issues - a.issues || a.owner.localeCompare(b.owner)
	);
}

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

// Sort, filter and search config for the full contributions list
export function contributionsConfig(rows: ContribRow[]): SortFilterConfig<ContribRow> {
	return {
		search: (row) => row.repo,
		sorts: [
			{ key: 'recent', label: 'Most recent', value: (row) => row.lastAt },
			{ key: 'diff', label: 'Largest diff', value: churn },
			{ key: 'prs', label: 'Most PRs', value: (row) => row.prs },
			{ key: 'issues', label: 'Most issues', value: (row) => row.issues },
			{ key: 'repo', label: 'Repository', value: (row) => row.repo }
		],
		filters: [
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
