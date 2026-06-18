import { graphql } from '$lib/server/github/client';
import { getUserOverview } from '$lib/server/github/user';
import { cached, isCached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import type {
	ContributionDay,
	ContributionTotals,
	UserContributions,
	YearCalendar
} from '$lib/types';

// Contributions move slowly once a year closes, so cache them for a few hours
const TTL = 4 * 3600;
// GitHub launched in 2008, cap the historic span so very old accounts stay bounded
const MAX_YEARS = 18;
const YEAR_CONCURRENCY = 4;

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
			}
		}
	}
`;

type RawCollection = {
	totalCommitContributions: number;
	totalIssueContributions: number;
	totalPullRequestContributions: number;
	totalPullRequestReviewContributions: number;
	restrictedContributionsCount: number;
	contributionCalendar: {
		weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
	};
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

// One calendar year of daily contributions and split totals
async function fetchYear(login: string, year: number): Promise<YearCalendar> {
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
	return { year, total, days, ...totals };
}

// Calendar years from the account's join year to now, capped to MAX_YEARS
function yearRange(createdAt: string): number[] {
	const now = new Date().getUTCFullYear();
	const first = Math.max(new Date(createdAt).getUTCFullYear(), now - MAX_YEARS + 1);
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

const statsKey = (login: string) => `user:contributions:2:${login.toLowerCase()}`;

// Whether contributions are cached, so the page renders inline vs streams
export const isContributionsCached = (login: string) => isCached(statsKey(login));

// All-time contributions for a user, one calendar per year, newest first
export function getUserContributions(login: string): Promise<UserContributions> {
	return cached(
		statsKey(login),
		async () => {
			const { profile } = await getUserOverview(login);
			const years = await mapLimit(yearRange(profile.createdAt), YEAR_CONCURRENCY, (year) =>
				fetchYear(login, year)
			);
			years.reverse();
			const totals = sumTotals(years);
			const total = years.reduce((sum, year) => sum + year.total, 0);
			return { total, totals, years };
		},
		TTL
	);
}
