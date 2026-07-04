export type PersonRow = { login: string; avatarUrl: string; at?: string };
export type RepoPeople = {
	stargazers: PersonRow[];
	stargazersTotal: number;
	stargazersAvailable: boolean;
	forks: PersonRow[];
	forksTotal: number;
	watchers: PersonRow[];
	watchersTotal: number;
};

export type ContributorRow = {
	login: string;
	avatarUrl: string;
	htmlUrl: string;
	contributions: number;
	additions: number;
	deletions: number;
	firstCommit: string | null;
	lastCommit: string | null;
	spark: number[];
};
// One week of repo-wide code churn, additions and deletions across all authors
export type WeekChurn = { week: string; additions: number; deletions: number };
export type RepoContributors = {
	contributors: ContributorRow[];
	total: number;
	sampled: boolean;
	weekly: WeekChurn[];
};
