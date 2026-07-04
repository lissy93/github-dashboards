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
	actor?: string | null;
};

// One page of the timeline, newest first, with the cursor for the next older page
export type ActivityPage = {
	events: ActivityEvent[];
	nextCursor: string | null;
};

// When a user is active, from tracked activity timestamps (UTC)
export type ActivityRhythm = {
	total: number;
	punch: number[][];
	peak: { weekday: number; hour: number; count: number } | null;
};

// Active months held in Goard's timeline, keyed by lower-case owner/repo
export type RepoActivityMonths = Record<string, string[]>;
