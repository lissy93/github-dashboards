export type PersonRow = { login: string; avatarUrl: string; at?: string };

// A recent-faces list for one audience, flagging why faces are missing when they are:
// 'restricted' when the token cannot read the list, 'capped' past GitHub's paging limit
export type AudienceSection = {
	people: PersonRow[];
	total: number;
	unavailable?: 'restricted' | 'capped';
};
export type RepoPeople = {
	stargazers: AudienceSection;
	forks: AudienceSection;
	watchers: AudienceSection;
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
