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

export type TrafficCount = { count: number; uniques: number };
export type RepoTrafficSummary = { available: boolean; views: TrafficCount; clones: TrafficCount };
export type RepoTraffic = RepoTrafficSummary & {
	topPaths: TrafficItem[];
	topReferrers: TrafficItem[];
};

// Views, unique views and clones per repo, pending true until loaded
export type RepoTrafficData = {
	pending: boolean;
	views: Record<string, number>;
	uniques: Record<string, number>;
	clones: Record<string, number>;
};
