export type TimelinePoint = {
	period: string;
	openedIssues: number;
	closedIssues: number;
	completedIssues: number;
	discardedIssues: number;
	openIssues: number;
	openedPrs: number;
	closedPrs: number;
	mergedPrs: number;
	discardedPrs: number;
	openPrs: number;
	// Median hours to resolve items closed in this bucket, null when none resolved
	resolveIssuesHours: number | null;
	resolvePrsHours: number | null;
};
export type Granularity = 'month' | 'week';
export type TimelineCore = {
	points: TimelinePoint[];
	sampled: boolean;
	granularity: Granularity;
};

// One duration band and how many resolved items fell into it
export type DurationBucket = { label: string; count: number };
// How long resolved items took, summarised server side so we ship counts not raw items
export type ResolutionStats = {
	count: number;
	medianHours: number | null;
	buckets: DurationBucket[];
};
// Time to close issues and merge PRs, the two resolution histograms for a repo
export type RepoResolution = { issues: ResolutionStats; prs: ResolutionStats };
export type TimelineBaseline = { total: number; open: number };

export type RepoTimeline = TimelineCore & {
	resolution: RepoResolution;
	baseline: { issues: TimelineBaseline; prs: TimelineBaseline };
};
