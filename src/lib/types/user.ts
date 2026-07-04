import type { Repo } from './repo';
import type { RepoActivityMonths } from './activity';

// The signed-in GitHub user, safe to expose to the browser
export type SessionUser = { login: string; name: string | null; avatarUrl: string };

export type Person = { login: string; avatarUrl: string };
// A named account: org membership, sponsor, or a follower
export type Org = { login: string; name: string | null; avatarUrl: string };
// A follower ranked by their own follower count
export type NotableFollower = Org & { followers: number };

export type UserProfile = {
	login: string;
	name: string | null;
	avatarUrl: string;
	bio: string | null;
	company: string | null;
	location: string | null;
	websiteUrl: string | null;
	twitter: string | null;
	isOrg: boolean;
	createdAt: string;
	followers: number;
	following: number;
	organizations: Org[];
	repoCount: number;
	totalStars: number;
	contributionsLastYear: number;
};

export type UserOverview = {
	profile: UserProfile;
	ownedRepos: Repo[];
	contributedRepos: Repo[];
	ownedReposCapped: boolean;
	contributedReposCapped: boolean;
};

// One day in the contribution calendar, count is total contributions that day
export type ContributionDay = { date: string; count: number };

// Contribution totals split by kind, restricted is private work
export type ContributionTotals = {
	commits: number;
	issues: number;
	prs: number;
	reviews: number;
	restricted: number;
};

// One calendar year: its daily calendar plus the split totals for that year
export type YearCalendar = ContributionTotals & {
	year: number;
	total: number;
	days: ContributionDay[];
};

// All-time contributions, per year, newest year first
export type UserContributions = {
	total: number;
	totals: ContributionTotals;
	years: YearCalendar[];
	commitMonths: RepoActivityMonths;
	yearsCovered: number;
	totalYears: number;
};

// Total bytes and repo count for one language across a user's repos
export type LanguageUsage = { name: string; color: string | null; bytes: number; repos: number };

// Lazily loaded social proof for a user, followers sampled from the connection
export type UserSocial = {
	topFollowers: NotableFollower[];
	newestFollowers: NotableFollower[];
	followersTotal: number;
	followersSampled: number;
	sponsorsTotal: number;
	sponsors: Org[];
};

// One recent stargazer, with the repo and time they starred for context
export type RecentStar = { login: string; avatarUrl: string; repo: string; starredAt: string };
