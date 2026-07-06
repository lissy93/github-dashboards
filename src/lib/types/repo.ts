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

// A bounded per-repo dataset with enough context to label sampled results honestly
export type OwnedRepoData<T> = {
	repos: Record<string, T>;
	total: number;
	sampled: boolean;
};

// One node in a repo's file tree, directories carry children and rolled-up metrics
export type TreeNode = {
	name: string;
	path: string;
	type: 'file' | 'dir';
	size: number;
	children?: TreeNode[];
	fileCount?: number;
};

// A repo's full file tree on its default branch, with headline counts
export type RepoTree = {
	branch: string;
	root: TreeNode[];
	totalFiles: number;
	totalDirs: number;
	totalSize: number;
	truncated: boolean;
};

// A branch or tag label pointing at a commit
export type CommitRef = { name: string; type: 'branch' | 'tag'; isDefault: boolean };

// The pull request that brought a commit in, external when raised from a fork
export type CommitPr = { number: number; state: 'open' | 'closed' | 'merged'; external: boolean };

// One commit in the history graph, parents drive the DAG edges
export type GraphCommit = {
	oid: string;
	short: string;
	message: string;
	date: string;
	author: string | null;
	login: string | null;
	parents: string[];
	refs: CommitRef[];
	pr: CommitPr | null;
};

// One page of commit history, newest first, with a cursor when older commits remain
export type CommitPage = { commits: GraphCommit[]; nextCursor: string | null };

// A repo's commit history as a DAG: the first page plus branch and tag context
export type RepoCommitGraph = CommitPage & {
	defaultBranch: string;
	branches: string[];
	branchCount: number;
	tagCount: number;
};

// How often a label appears across a repo's issues and PRs
export type LabelCount = {
	name: string;
	color: string;
	issues: number;
	prs: number;
	total: number;
};

// A repo's reconstructed star curve, sampled once GitHub stops paginating
export type RepoStarHistory = {
	days: string[];
	stars: number[];
	sampled: boolean;
	restricted: boolean;
};
