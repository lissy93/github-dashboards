// One day of run or deployment outcomes
export type OutcomeBucket = { date: string; success: number; failure: number; other: number };
export type OutcomeKind = 'success' | 'failure' | 'other';

export type WorkflowSummary = {
	id: number;
	name: string;
	state: string;
	path: string;
	latest: {
		status: string | null;
		conclusion: string | null;
		runUrl: string | null;
		createdAt: string | null;
		event: string | null;
	} | null;
	passRate: number | null;
	avgRuntimeSec: number | null;
	runsSampled: number;
	retryRate: number | null;
};
export type RepoWorkflows = {
	workflows: WorkflowSummary[];
	totalRuns: number | null;
	totalWorkflows: number;
	sampled: boolean;
};
export type RepoRunActivity = { buckets: OutcomeBucket[]; total: number; sampled: boolean };

export type DeployRecord = {
	environment: string;
	state: string | null;
	ref: string | null;
	commitOid: string;
	creator: string | null;
	createdAt: string;
	url: string | null;
	logUrl: string | null;
	description: string | null;
};
export type EnvironmentSummary = {
	name: string;
	count: number;
	last: DeployRecord | null;
	live: DeployRecord | null;
	protected: boolean;
};
export type RepoDeployments = {
	totalDeployments: number;
	sampled: boolean;
	successRate: number | null;
	lastDeployAt: string | null;
	environments: EnvironmentSummary[];
	recent: DeployRecord[];
	frequency: OutcomeBucket[];
};

export type PagesBuild = {
	status: string;
	createdAt: string;
	duration: number;
	commitSha: string | null;
	url: string | null;
	error: string | null;
};
export type RepoPages = {
	enabled: boolean;
	url: string | null;
	cname: string | null;
	https: boolean;
	source: { branch: string; path: string } | null;
	buildType: string | null;
	status: string | null;
	builds: PagesBuild[];
	certificate: { state: string; expiresAt: string | null } | null;
};

export type ReleaseRow = {
	name: string;
	tag: string;
	publishedAt: string;
	prerelease: boolean;
	downloads: number;
	hasAssets: boolean;
	url: string;
	author: string | null;
};
export type RepoReleases = { releases: ReleaseRow[]; total: number; sampled: boolean };
