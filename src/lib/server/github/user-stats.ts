import { graphql } from '$lib/server/github/client';
import { getUserOverview } from '$lib/server/github/user';
import { cached, isCached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import type {
	ContributionDay,
	ContributionTotals,
	RepoActivityMonths,
	UserContributions,
	YearCalendar
} from '$lib/types';

// Contributions move slowly once a year closes, so cache them for a few hours
const TTL = 4 * 3600;
const YEAR_CONCURRENCY = 4;
const MAX_REPOSITORIES = 100;
const CONTRIBUTION_DAYS = 100;

const QUERY = `
	query YearContributions($login: String!, $from: DateTime!, $to: DateTime!) {
		user(login: $login) {
			contributionsCollection(from: $from, to: $to) {
				totalCommitContributions
				totalIssueContributions
				totalPullRequestContributions
				totalPullRequestReviewContributions
				restrictedContributionsCount
				contributionCalendar {
					weeks { contributionDays { date contributionCount } }
				}
				commitContributionsByRepository(maxRepositories: ${MAX_REPOSITORIES}) {
					repository { nameWithOwner }
					first: contributions(first: ${CONTRIBUTION_DAYS}) {
						nodes { occurredAt }
						pageInfo { hasNextPage }
					}
					last: contributions(last: ${CONTRIBUTION_DAYS}) {
						nodes { occurredAt }
						pageInfo { hasPreviousPage }
					}
				}
			}
		}
	}
`;

type RawCommitGroup = {
	repository: { nameWithOwner: string };
	first: {
		nodes: { occurredAt: string }[];
		pageInfo: { hasNextPage: boolean };
	};
	last: {
		nodes: { occurredAt: string }[];
		pageInfo: { hasPreviousPage: boolean };
	};
};

type RawCollection = {
	totalCommitContributions: number;
	totalIssueContributions: number;
	totalPullRequestContributions: number;
	totalPullRequestReviewContributions: number;
	restrictedContributionsCount: number;
	contributionCalendar: {
		weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
	};
	commitContributionsByRepository: RawCommitGroup[];
};

const EMPTY_TOTALS: ContributionTotals = {
	commits: 0,
	issues: 0,
	prs: 0,
	reviews: 0,
	restricted: 0
};

function totalsOf(raw: RawCollection): ContributionTotals {
	return {
		commits: raw.totalCommitContributions,
		issues: raw.totalIssueContributions,
		prs: raw.totalPullRequestContributions,
		reviews: raw.totalPullRequestReviewContributions,
		restricted: raw.restrictedContributionsCount
	};
}

// Flatten the nested weeks GitHub returns into a flat list of days
function flattenDays(raw: RawCollection): ContributionDay[] {
	return raw.contributionCalendar.weeks.flatMap((week) =>
		week.contributionDays.map((day) => ({ date: day.date, count: day.contributionCount }))
	);
}

type FetchedYear = {
	calendar: YearCalendar;
	commitMonths: RepoActivityMonths;
};

const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;
const allMonths = (year: number) =>
	Array.from({ length: 12 }, (_, month) => `${year}-${String(month + 1).padStart(2, '0')}-01`);

// Extract commit months, keeping busy truncated repos conservatively active all year
export function commitMonthsOf(groups: RawCommitGroup[], year: number): RepoActivityMonths {
	const out: RepoActivityMonths = {};
	for (const group of groups) {
		const first = new Set(group.first.nodes.map((node) => node.occurredAt));
		const last = new Set(group.last.nodes.map((node) => node.occurredAt));
		const dates = new Set([...first, ...last]);
		const overlaps = [...first].some((date) => last.has(date));
		const truncated =
			group.first.pageInfo.hasNextPage && group.last.pageInfo.hasPreviousPage && !overlaps;
		const key = group.repository.nameWithOwner.toLowerCase();
		out[key] = truncated ? allMonths(year) : [...new Set([...dates].map(monthOf))].sort();
	}
	return out;
}

// One calendar year of contribution totals and per-repo commit months
async function fetchYear(login: string, year: number): Promise<FetchedYear> {
	const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
	const to = yearEnd > new Date() ? new Date() : yearEnd;
	const from = new Date(Date.UTC(year, 0, 1));
	const { user } = await graphql<{ user: { contributionsCollection: RawCollection } | null }>(
		QUERY,
		{ login, from: from.toISOString(), to: to.toISOString() }
	);
	const collection = user?.contributionsCollection;
	const totals = collection ? totalsOf(collection) : EMPTY_TOTALS;
	const days = collection ? flattenDays(collection) : [];
	const total = days.reduce((sum, day) => sum + day.count, 0);
	return {
		calendar: { year, total, days, ...totals },
		commitMonths: collection ? commitMonthsOf(collection.commitContributionsByRepository, year) : {}
	};
}

// Calendar years from the account's join year to now
function yearRange(createdAt: string): number[] {
	const now = new Date().getUTCFullYear();
	const first = new Date(createdAt).getUTCFullYear();
	return Array.from({ length: now - first + 1 }, (_, index) => first + index);
}

// Sum each split total across every year for the all-time figures
function sumTotals(years: YearCalendar[]): ContributionTotals {
	return years.reduce(
		(sum, year) => ({
			commits: sum.commits + year.commits,
			issues: sum.issues + year.issues,
			prs: sum.prs + year.prs,
			reviews: sum.reviews + year.reviews,
			restricted: sum.restricted + year.restricted
		}),
		{ ...EMPTY_TOTALS }
	);
}

const statsKey = (login: string) => `user:contributions:4:${login.toLowerCase()}`;

// Whether contributions are cached, so the page renders inline vs streams
export const isContributionsCached = (login: string) => isCached(statsKey(login));

// All-time contributions for a user, one calendar per year, newest first
export function getUserContributions(login: string): Promise<UserContributions> {
	return cached(
		statsKey(login),
		async () => {
			const { profile } = await getUserOverview(login);
			const fetched = await mapLimit(yearRange(profile.createdAt), YEAR_CONCURRENCY, (year) =>
				fetchYear(login, year)
			);
			const years = fetched.map((year) => year.calendar);
			years.reverse();
			const totals = sumTotals(years);
			const total = years.reduce((sum, year) => sum + year.total, 0);
			const commitMonths: RepoActivityMonths = {};
			for (const year of fetched) {
				for (const [repo, months] of Object.entries(year.commitMonths)) {
					(commitMonths[repo] ??= []).push(...months);
				}
			}
			return { total, totals, years, commitMonths };
		},
		TTL
	);
}
