// The signed-in GitHub user, safe to expose to the browser
export type SessionUser = { login: string; name: string | null; avatarUrl: string };

// One item in a repo's top-paths or top-referrers list
export type TrafficItem = { label: string; sublabel?: string; count: number; uniques: number };

// One repo's traffic for a single day, the stored unit we accumulate history from
export type TrafficDay = {
	repo: string;
	day: string;
	views: number;
	uniqueViews: number;
	clones: number;
	uniqueClones: number;
};

// A top-paths or referrer item tagged with the repo it came from
export type AnalyticsItem = TrafficItem & { repo: string };

// Combined traffic analytics across all of an owner's repos
export type UserAnalytics = {
	repos: string[];
	capped: boolean;
	daily: TrafficDay[];
	paths: AnalyticsItem[];
	referrers: AnalyticsItem[];
};

export type Language = { name: string; color: string | null };

// One language's byte size within a single repo, before any cross-repo totals
export type RepoLang = { name: string; color: string | null; bytes: number };

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
	topics: string[];
};

// Heavier per-repo counts fetched lazily so the list renders fast
export type RepoStats = {
	closedIssues: number;
	mergedPRs: number;
	closedPRs: number;
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
};

// A bounded per-repo dataset with enough context to label sampled results honestly
export type OwnedRepoData<T> = {
	repos: Record<string, T>;
	total: number;
	sampled: boolean;
};

// Total bytes and repo count for one language across a user's repos
export type LanguageUsage = { name: string; color: string | null; bytes: number; repos: number };

// When a user is active, from tracked activity timestamps (UTC)
export type ActivityRhythm = {
	total: number;
	punch: number[][];
	peak: { weekday: number; hour: number; count: number } | null;
};

// Active months held in Goard's timeline, keyed by lower-case owner/repo
export type RepoActivityMonths = Record<string, string[]>;

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
	| 'member'
	| 'discussion'
	| 'sponsor';

// Non-zero reaction counts keyed by GitHub content name (+1, heart, …)
export type Reactions = Record<string, number>;

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
	reactions: Reactions | null;
};

// One page of the timeline, newest first, with the cursor for the next older page
export type ActivityPage = {
	events: ActivityEvent[];
	nextCursor: string | null;
};

export type Person = { login: string; avatarUrl: string };
// A named account: org membership, sponsor, or a follower
export type Org = { login: string; name: string | null; avatarUrl: string };
// A follower ranked by their own follower count
export type NotableFollower = Org & { followers: number };
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
export type IssueLabel = { name: string; color: string };

// PR check rollup and review state, normalised to lowercase tokens, null when absent
export type CheckState = 'success' | 'failure' | 'pending';
export type ReviewDecision = 'approved' | 'changes_requested' | 'review_required';

// One open issue or PR row, shared by every task list. PR-only fields stay null on issues
export type TaskItem = {
	id: string;
	kind: 'pr' | 'issue';
	number: number;
	title: string;
	url: string;
	repo: string;
	draft: boolean;
	createdAt: string;
	updatedAt: string;
	author: Person | null;
	assignees: Person[];
	labels: IssueLabel[];
	comments: number;
	reviewDecision: ReviewDecision | null;
	checks: CheckState | null;
	additions: number | null;
	deletions: number | null;
	changedFiles: number | null;
};

// The four task buckets, see TASK_BUCKETS for their titles and routes
export type TaskBucket = 'reviewPrs' | 'myPrs' | 'reviewIssues' | 'myIssues';

// One bucket of items, total is the deduped count we hold, capped when truncated
export type TaskList = { items: TaskItem[]; total: number; capped: boolean };

export type TaskData = {
	login: string;
	isOrg: boolean;
	buckets: Record<TaskBucket, TaskList>;
};
