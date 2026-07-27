import type { RepoTimeline } from '$lib/types';
import { buildTimelineState } from '$lib/server/github/repo-timeline';
import { getUserOverview } from '$lib/server/github/user';
import {
	syncCrawl,
	type CrawlKind,
	type CrawlSource,
	type CrawlState
} from '$lib/server/github/timeline-crawl';
import { advanceCheckpointed, checkpointed, isCached, readCached } from '$lib/server/cache';

// Short freshness, the on-land advance path deepens older history for signed-in viewers
const TTL = 300;
// Bump when the stored node shape changes, to retire old entries
const key = (login: string) => `user:authored:v1:${login.toLowerCase()}`;

// Authored nodes carry their repo and, for PRs, the diff size, so the per-repo
// contributions view reduces straight over this crawl. Star count and language stay out,
// they change over time and are hydrated from the repo cache when a view needs them
type IssueNode = {
	id: string;
	createdAt: string;
	closedAt: string | null;
	stateReason: string | null;
	repository: { nameWithOwner: string };
};
type PrNode = {
	id: string;
	createdAt: string;
	closedAt: string | null;
	merged: boolean;
	additions: number;
	deletions: number;
	repository: { nameWithOwner: string };
};
export type AuthoredState = CrawlState<IssueNode, PrNode>;

const FIELDS: Record<CrawlKind, string> = {
	issues: 'id createdAt closedAt stateReason repository { nameWithOwner }',
	pullRequests: 'id createdAt closedAt merged additions deletions repository { nameWithOwner }'
};

// The crawl source for one user: the issues and PRs this account authored across GitHub
function userSource(login: string): CrawlSource {
	return {
		root: 'user',
		args: 'login: $login',
		params: '$login: String!',
		variables: { login },
		fields: FIELDS
	};
}

// Orgs author nothing, so their state is empty rather than a crawl of a missing user
async function isOrg(login: string): Promise<boolean> {
	return (await getUserOverview(login)).profile.isOrg;
}

// A crawl with no history, for accounts that author nothing
function emptyState(): AuthoredState {
	const crawl = () => ({ nodes: [], cursor: null, complete: true, total: 0, openTotal: 0 });
	return { issues: crawl(), prs: crawl() };
}

export const isAuthoredTimelineCached = (login: string) => isCached(key(login));

// The user's authored issue/PR crawl, served from the last checkpoint while a background
// sync refreshes recent items and resumes older history. Folded two ways below
export async function getAuthoredState(login: string): Promise<AuthoredState> {
	if (await isOrg(login)) return emptyState();
	const source = userSource(login);
	return checkpointed<AuthoredState>('authored-timeline', key(login), TTL, (current) =>
		syncCrawl<IssueNode, PrNode>(source, 'authored-timeline', current)
	);
}

// Crawl one more batch of older authored history on demand, so a signed-in viewer deepens
// the all-time totals and later viewers get the warm cache
export async function advanceAuthoredState(login: string): Promise<AuthoredState> {
	if (await isOrg(login)) return emptyState();
	const stored = await readCached<AuthoredState>(key(login));
	const current = stored?.value;
	if (current && current.issues.complete && current.prs.complete) return current;
	const source = userSource(login);
	return advanceCheckpointed<AuthoredState>(key(login), TTL, (state) =>
		syncCrawl<IssueNode, PrNode>(source, 'authored-timeline', state)
	);
}

// The user's all-time authored issue/PR timeline
export async function getAuthoredTimeline(login: string): Promise<RepoTimeline> {
	return buildTimelineState(await getAuthoredState(login));
}

// The authored timeline deepened one more batch for a signed-in viewer
export async function advanceAuthoredTimeline(login: string): Promise<RepoTimeline> {
	return buildTimelineState(await advanceAuthoredState(login));
}
