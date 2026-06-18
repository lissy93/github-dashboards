export type Language = { name: string; color: string | null };

export type Release = { tag: string; publishedAt: string };

export type Repo = {
	owner: string;
	name: string;
	nameWithOwner: string;
	description: string | null;
	url: string;
	stars: number;
	forks: number;
	watchers: number;
	openIssues: number;
	openPRs: number;
	diskUsage: number;
	language: Language | null;
	createdAt: string;
	updatedAt: string;
	pushedAt: string;
	isPrivate: boolean;
	isArchived: boolean;
	isFork: boolean;
	license: string | null;
};

// Heavier per-repo counts fetched lazily so the list renders fast
export type RepoStats = {
	closedIssues: number;
	mergedPRs: number;
	commits: number;
	releaseCount: number;
	latestRelease: Release | null;
};

// Lazily loaded per-repo data shown on the detailed owned card
export type RepoExtras = {
	views?: number;
	uniqueViews?: number;
	clones?: number;
	contributors?: number;
	starDelta?: number | null;
	starWindow?: number;
	stats?: RepoStats;
};

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
	repoCount: number;
	totalStars: number;
	contributionsLastYear: number;
};

export type UserOverview = {
	profile: UserProfile;
	ownedRepos: Repo[];
	contributedRepos: Repo[];
};

// Normalised activity kinds, shared by the events feed and the GraphQL backfill
export type ActivityType =
	| 'pr'
	| 'issue'
	| 'comment'
	| 'review'
	| 'release'
	| 'push'
	| 'star'
	| 'fork'
	| 'create'
	| 'delete'
	| 'wiki'
	| 'public'
	| 'member';

// One timeline row, source-agnostic. id is deterministic so sources dedupe
export type ActivityEvent = {
	id: string;
	type: ActivityType;
	action: string | null;
	createdAt: string;
	repo: string;
	title: string | null;
	body: string | null;
	url: string;
	payload: Record<string, unknown> | null;
};

// One page of the timeline, newest first, with the cursor for the next older page
export type ActivityPage = {
	events: ActivityEvent[];
	nextCursor: string | null;
};
