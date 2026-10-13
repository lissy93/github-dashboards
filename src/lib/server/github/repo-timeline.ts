import type {
	Granularity,
	RepoResolution,
	RepoTimeline,
	ResolutionStats,
	TimelineBaseline,
	TimelineCore
} from '$lib/types';
import { median, monthStartOf, weekStartOf } from '$lib/utils/datetime';
import { advanceCheckpointed, checkpointed, readCached } from '$lib/server/cache';
import {
	syncCrawl,
	type Crawl,
	type CrawlKind,
	type CrawlSource,
	type CrawlState
} from '$lib/server/github/timeline-crawl';

// Refresh changed and new items often, while each refresh resumes a bounded older backfill
const TTL = 300;

// A created/closed item, resolved means merged (PR) or completed (issue), default true
export type Lifecycle = { createdAt: string; closedAt: string | null; resolved?: boolean };

type IssueNode = {
	id: string;
	createdAt: string;
	closedAt: string | null;
	stateReason: string | null;
};
type PrNode = { id: string; createdAt: string; closedAt: string | null; merged: boolean };

const FIELDS: Record<CrawlKind, string> = {
	issues: 'id createdAt closedAt stateReason',
	pullRequests: 'id createdAt closedAt merged'
};

// The crawl source for one repository, its issue/PR connections keyed by owner and name
function repoSource(owner: string, name: string): CrawlSource {
	return {
		root: 'repository',
		args: 'owner: $owner, name: $name',
		params: '$owner: String!, $name: String!',
		variables: { owner, name },
		fields: FIELDS
	};
}

const pad = (value: number) => String(value).padStart(2, '0');
// Repos with under a year of history bucket by week, so the bars carry detail
const YEAR_MS = 365 * 86400000;

// A closed issue counts as resolved unless GitHub marked it not planned or a duplicate
export function issueResolved(stateReason: string | null): boolean {
	return stateReason !== 'NOT_PLANNED' && stateReason !== 'DUPLICATE';
}

// Duration bands for the resolution histograms, upper bound in hours, last is open ended
const DURATION_BUCKETS: { label: string; max: number }[] = [
	{ label: '< 1h', max: 1 },
	{ label: '< 1d', max: 24 },
	{ label: '< 1w', max: 24 * 7 },
	{ label: '< 1mo', max: 24 * 30 },
	{ label: '< 6mo', max: 24 * 182 },
	{ label: '6mo+', max: Infinity }
];

// Hours between two timestamps, never negative for an out-of-order pair
const hoursBetween = (createdAt: string, closedAt: string) =>
	Math.max(0, (Date.parse(closedAt) - Date.parse(createdAt)) / 3600000);

// Median duration and a per-band count over a set of resolution times. Pure, so the
// histogram maths tests apart from the GraphQL walk
export function resolutionStats(hours: number[]): ResolutionStats {
	const buckets = DURATION_BUCKETS.map((band) => ({ label: band.label, count: 0 }));
	for (const value of hours) {
		const index = DURATION_BUCKETS.findIndex((band) => value < band.max);
		buckets[index === -1 ? buckets.length - 1 : index].count += 1;
	}
	return { count: hours.length, medianHours: median(hours), buckets };
}

// Resolution times for completed issues and merged PRs, from the walked lifecycle nodes
function buildResolution(issues: IssueNode[], prs: PrNode[]): RepoResolution {
	const issueHours = issues
		.filter((node) => node.closedAt && issueResolved(node.stateReason))
		.map((node) => hoursBetween(node.createdAt, node.closedAt!));
	const prHours = prs
		.filter((node) => node.merged && node.closedAt)
		.map((node) => hoursBetween(node.createdAt, node.closedAt!));
	return { issues: resolutionStats(issueHours), prs: resolutionStats(prHours) };
}

// Bucket-start date (YYYY-MM-DD) for a timestamp: first of the month, or the week's Monday
function bucketStart(iso: string, granularity: Granularity): string {
	return granularity === 'week' ? weekStartOf(iso) : monthStartOf(iso);
}

// Every bucket start from the earliest activity to now, so quiet spells still show
function bucketRange(earliest: string, granularity: Granularity): string[] {
	const buckets: string[] = [];
	const end = bucketStart(new Date().toISOString(), granularity);
	if (granularity === 'week') {
		let cursor = new Date(`${earliest}T00:00:00Z`);
		const last = new Date(`${end}T00:00:00Z`);
		while (cursor <= last) {
			buckets.push(cursor.toISOString().slice(0, 10));
			cursor = new Date(cursor.getTime() + 7 * 86400000);
		}
		return buckets;
	}
	let [year, monthNum] = earliest.split('-').map(Number);
	const [endYear, endMonth] = end.split('-').map(Number);
	while (year < endYear || (year === endYear && monthNum <= endMonth)) {
		buckets.push(`${year}-${pad(monthNum)}-01`);
		monthNum += 1;
		if (monthNum > 12) {
			monthNum = 1;
			year += 1;
		}
	}
	return buckets;
}

export type TimelineState = CrawlState<IssueNode, PrNode>;

// Tally opened counts, and closed counts split by whether each item was resolved,
// collecting resolution durations per close bucket for the speed trend
function tally(
	nodes: Lifecycle[],
	granularity: Granularity,
	opened: Map<string, number>,
	resolved: Map<string, number>,
	discarded: Map<string, number>,
	resolvedHours: Map<string, number[]>
) {
	for (const node of nodes) {
		const open = bucketStart(node.createdAt, granularity);
		opened.set(open, (opened.get(open) ?? 0) + 1);
		if (node.closedAt) {
			const close = bucketStart(node.closedAt, granularity);
			if (node.resolved === false) {
				discarded.set(close, (discarded.get(close) ?? 0) + 1);
			} else {
				resolved.set(close, (resolved.get(close) ?? 0) + 1);
				const hours = resolvedHours.get(close) ?? [];
				hours.push(hoursBetween(node.createdAt, node.closedAt));
				resolvedHours.set(close, hours);
			}
		}
	}
}

// Bucket created/closed dates into opened, closed and running open counts, weekly for
// young repos and monthly otherwise. Closed counts split into resolved (merged/completed)
// and discarded (closed/not planned). Pure, so the GraphQL walk and the maths test apart
export function buildTimeline(
	issues: Lifecycle[],
	prs: Lifecycle[],
	sampled = false,
	initialOpen = { issues: 0, prs: 0 }
): TimelineCore {
	const earliestIso = [...issues, ...prs].map((node) => node.createdAt).sort()[0];
	const granularity: Granularity =
		earliestIso && Date.now() - Date.parse(earliestIso) < YEAR_MS ? 'week' : 'month';
	if (!earliestIso) return { points: [], sampled, granularity };

	const openedIssues = new Map<string, number>();
	const completedIssues = new Map<string, number>();
	const discardedIssues = new Map<string, number>();
	const issueResolvedHours = new Map<string, number[]>();
	const openedPrs = new Map<string, number>();
	const mergedPrs = new Map<string, number>();
	const discardedPrs = new Map<string, number>();
	const prResolvedHours = new Map<string, number[]>();
	tally(issues, granularity, openedIssues, completedIssues, discardedIssues, issueResolvedHours);
	tally(prs, granularity, openedPrs, mergedPrs, discardedPrs, prResolvedHours);

	const buckets = bucketRange(bucketStart(earliestIso, granularity), granularity);

	let runningIssues = initialOpen.issues;
	let runningPrs = initialOpen.prs;
	const points = buckets.map((period) => {
		const oi = openedIssues.get(period) ?? 0;
		const compI = completedIssues.get(period) ?? 0;
		const discI = discardedIssues.get(period) ?? 0;
		const ci = compI + discI;
		const op = openedPrs.get(period) ?? 0;
		const mp = mergedPrs.get(period) ?? 0;
		const discP = discardedPrs.get(period) ?? 0;
		const cp = mp + discP;
		runningIssues = Math.max(0, runningIssues + oi - ci);
		runningPrs = Math.max(0, runningPrs + op - cp);
		return {
			period,
			openedIssues: oi,
			closedIssues: ci,
			completedIssues: compI,
			discardedIssues: discI,
			openIssues: runningIssues,
			openedPrs: op,
			closedPrs: cp,
			mergedPrs: mp,
			discardedPrs: discP,
			openPrs: runningPrs,
			resolveIssuesHours: median(issueResolvedHours.get(period) ?? []),
			resolvePrsHours: median(prResolvedHours.get(period) ?? [])
		};
	});

	return { points, sampled, granularity };
}

// The pre-window counts for one kind: items that exist beyond the crawled nodes, so the
// chart can show them as earlier history. Zero once that kind is fully crawled
function baselineOf(crawl: Crawl<{ closedAt: string | null }>): TimelineBaseline {
	if (crawl.complete) return { total: 0, open: 0 };
	return {
		total: Math.max(0, crawl.total - crawl.nodes.length),
		open: Math.max(0, crawl.openTotal - crawl.nodes.filter((node) => !node.closedAt).length)
	};
}

// Lifecycle arrays plus the pre-window baseline from a stored crawl, shared by the repo
// timeline and the user aggregate that folds many repos into one timeline
export function timelineContribution(state: TimelineState): {
	issues: Lifecycle[];
	prs: Lifecycle[];
	baseline: { issues: TimelineBaseline; prs: TimelineBaseline };
	complete: boolean;
} {
	const issues: Lifecycle[] = state.issues.nodes.map((node) => ({
		createdAt: node.createdAt,
		closedAt: node.closedAt,
		resolved: issueResolved(node.stateReason)
	}));
	const prs: Lifecycle[] = state.prs.nodes.map((node) => ({
		createdAt: node.createdAt,
		closedAt: node.closedAt,
		resolved: node.merged
	}));
	return {
		issues,
		prs,
		baseline: { issues: baselineOf(state.issues), prs: baselineOf(state.prs) },
		complete: state.issues.complete && state.prs.complete
	};
}

// Fold a crawl state into the shared all-time timeline, reused by the user contributions
// crawl whose richer nodes are a superset of these
export function buildTimelineState(state: TimelineState): RepoTimeline {
	const { issues, prs } = state;
	const part = timelineContribution(state);
	const initialOpen = { issues: part.baseline.issues.open, prs: part.baseline.prs.open };
	const core = buildTimeline(part.issues, part.prs, !part.complete, initialOpen);
	return { ...core, resolution: buildResolution(issues.nodes, prs.nodes), baseline: part.baseline };
}

export const repoTimelineKey = (owner: string, name: string) =>
	`repo:timeline-state:v1:${owner}/${name}`.toLowerCase();

// Serve the last good timeline immediately, refreshing recent rows and resuming older
// history in the background. A cold repo fetches one bounded batch before first render
export async function getRepoIssuePrTimeline(owner: string, name: string): Promise<RepoTimeline> {
	const source = repoSource(owner, name);
	const state = await checkpointed<TimelineState>(
		'repo-timeline',
		repoTimelineKey(owner, name),
		TTL,
		(current) => syncCrawl<IssueNode, PrNode>(source, 'repo-timeline', current)
	);
	return buildTimelineState(state);
}

// one sync round now, ignoring how fresh the checkpoint is
export function sweepRepoTimeline(owner: string, name: string): Promise<TimelineState> {
	const source = repoSource(owner, name);
	return advanceCheckpointed<TimelineState>(repoTimelineKey(owner, name), TTL, (state) =>
		syncCrawl<IssueNode, PrNode>(source, 'repo-timeline', state)
	);
}

// Crawl one more batch of older history on demand and persist it, so a signed-in viewer
// can progressively deepen the timeline past the background bound, cached for later viewers
export async function advanceRepoTimeline(owner: string, name: string): Promise<RepoTimeline> {
	const stored = await readCached<TimelineState>(repoTimelineKey(owner, name));
	const current = stored?.value;
	// A fully crawled repo only wants the odd changed-items sweep, so one still fresh from its
	// last sync hands back what we have, a stale one falls through to resync recent changes
	if (stored && current?.issues.complete && current.prs.complete) {
		if (Date.now() - stored.fetchedAt.getTime() < TTL * 1000) return buildTimelineState(current);
	}
	return buildTimelineState(await sweepRepoTimeline(owner, name));
}
