// A user's authored work in one repo within a single year, owned means the repo sits
// under the user's own namespace. lastAt is the most recent contribution that year, so
// rows sort by recency. prs is every PR opened, mergedPrs those that landed and closedPrs
// those closed without merging, so the rest are still open. Issues split the same way
export type AuthoredRepo = {
	repo: string;
	owned: boolean;
	lastAt: string;
	prs: number;
	mergedPrs: number;
	closedPrs: number;
	issues: number;
	closedIssues: number;
	additions: number;
	deletions: number;
};

// One year of authored contributions, its repos ranked by how much the user did there
export type AuthoredYear = { year: number; repos: AuthoredRepo[] };

// All-time authored contributions grouped by year, newest first. complete is false while
// the crawl is still resuming older history
export type AuthoredContributions = { years: AuthoredYear[]; complete: boolean };
