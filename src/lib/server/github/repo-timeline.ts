import type {
	Granularity,
	RepoResolution,
	RepoTimeline,
	ResolutionStats,
	TimelineCore
} from '$lib/types';
import { paginate } from '$lib/server/github/client';
import { median, monthStartOf, weekStartOf } from '$lib/utils/datetime';
import { advanceCheckpointed, checkpointed, isCached, readCached } from '$lib/server/cache';
import { logError } from '$lib/utils/errors';

// Refresh changed and new items often, while each refresh resumes a bounded older backfill
const TTL = 300;
const PER_PAGE = 100;
const BACKFILL_PAGES = 10;
// Page cap on the changed-item sweep, plenty for the updates between two visits
const SWEEP_PAGES = 3;

// A created/closed item, resolved means merged (PR) or completed (issue), default true
export type Lifecycle = { createdAt: string; closedAt: string | null; resolved?: boolean };

type IssueNode = {
	id: string;
	createdAt: string;
	closedAt: string | null;
	stateReason: string | null;
};
type PrNode = { id: string; createdAt: string; closedAt: string | null; merged: boolean };
type Conn<T> = {
	totalCount: number;
	nodes: T[];
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
};
type TimelineResp<T> = {
	repository: {
		issues?: Conn<T>;
		pullRequests?: Conn<T>;
		open: { totalCount: number };
	} | null;
};

type Kind = 'issues' | 'pullRequests';
type Order = 'CREATED_AT' | 'UPDATED_AT';
// The sweep reads each node's updatedAt to know when it is back past the watermark
type Updated = { updatedAt: string };

const NODE_FIELDS: Record<Kind, string> = {
	issues: 'id createdAt closedAt stateReason',
	pullRequests: 'id createdAt closedAt merged'
};

const query = (field: Kind, order: Order) => `
	query RepoTimeline($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			${field}(first: ${PER_PAGE}, after: $cursor, orderBy: { field: ${order}, direction: DESC }) {
				totalCount
				nodes { ${NODE_FIELDS[field]}${order === 'UPDATED_AT' ? ' updatedAt' : ''} }
				pageInfo { hasNextPage endCursor }
			}
			open: ${field}(states: OPEN) { totalCount }
		}
	}
`;

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

type Crawl<T> = {
	nodes: T[];
	cursor: string | null;
	complete: boolean;
	total: number;
	openTotal: number;
	syncedAt?: string;
};
type TimelineState = { issues: Crawl<IssueNode>; prs: Crawl<PrNode> };

type BatchOptions<T> = {
	pages: number;
	cursor?: string | null;
	order?: Order;
	until?: (page: T[]) => boolean;
};

// Fetch one bounded batch, returning the cursor needed to resume older history
async function fetchBatch<T extends { id: string }>(
	owner: string,
	name: string,
	kind: Kind,
	options: BatchOptions<T>
): Promise<Crawl<T>> {
	let openTotal = 0;
	let total = 0;
	const { nodes, cursor, complete } = await paginate<T, TimelineResp<T>>(
		query(kind, options.order ?? 'CREATED_AT'),
		{ owner, name },
		(data) => {
			const conn = data.repository?.[kind];
			if (conn) {
				openTotal = data.repository?.open.totalCount ?? 0;
				total = conn.totalCount;
			}
			return conn;
		},
		{ maxPages: options.pages, cursor: options.cursor, until: options.until }
	);
	return { nodes, cursor, complete, openTotal, total };
}

// Re-fetch items changed since the watermark, newest change first, so old items closed,
// merged or reopened while cached get their stored lifecycle corrected. New items surface
// here too, and one page usually covers the gap between visits. A state from before
// watermarks existed gets one deeper catch-up sweep
async function fetchUpdatedBatch<T extends { id: string }>(
	owner: string,
	name: string,
	kind: Kind,
	since?: string
): Promise<Crawl<T>> {
	const batch = await fetchBatch<T & Updated>(owner, name, kind, {
		order: 'UPDATED_AT',
		pages: since ? SWEEP_PAGES : BACKFILL_PAGES,
		until: (page) => !!since && page.some((node) => node.updatedAt < since)
	});
	// updatedAt only drives the watermark check, drop it so stored nodes keep one shape
	for (const node of batch.nodes) delete (node as Partial<Updated>).updatedAt;
	return batch;
}

// Merge refreshed rows by GitHub id, preferring the newest state for reopened items
function merge<T extends { id: string }>(...groups: T[][]): T[] {
	return [...new Map(groups.flat().map((node) => [node.id, node])).values()];
}

// Sweep changed items, then resume the older backfill from the checkpoint. The watermark
// is taken before fetching, so updates landing mid-sync are swept again next time
async function syncKind<T extends Lifecycle & { id: string }>(
	owner: string,
	name: string,
	kind: Kind,
	current?: Crawl<T>
): Promise<Crawl<T>> {
	const syncedAt = new Date().toISOString();
	if (!current) {
		return { ...(await fetchBatch<T>(owner, name, kind, { pages: BACKFILL_PAGES })), syncedAt };
	}

	const updated = await fetchUpdatedBatch<T>(owner, name, kind, current.syncedAt);
	if (current.complete) {
		return {
			...current,
			nodes: merge(current.nodes, updated.nodes),
			total: updated.total,
			openTotal: updated.openTotal,
			syncedAt
		};
	}

	const older = await fetchBatch<T>(owner, name, kind, {
		cursor: current.cursor,
		pages: BACKFILL_PAGES
	});
	return {
		nodes: merge(current.nodes, older.nodes, updated.nodes),
		cursor: older.cursor,
		complete: older.complete,
		total: updated.total,
		openTotal: updated.openTotal,
		syncedAt
	};
}

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

function build(state: TimelineState): RepoTimeline {
	const { issues, prs } = state;
	issues.nodes.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
	prs.nodes.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
	const issueLife: Lifecycle[] = issues.nodes.map((node) => ({
		createdAt: node.createdAt,
		closedAt: node.closedAt,
		resolved: issueResolved(node.stateReason)
	}));
	const prLife: Lifecycle[] = prs.nodes.map((node) => ({
		createdAt: node.createdAt,
		closedAt: node.closedAt,
		resolved: node.merged
	}));
	const sampled = !issues.complete || !prs.complete;
	const baseline = {
		issues: {
			total: !issues.complete ? Math.max(0, issues.total - issues.nodes.length) : 0,
			open: !issues.complete
				? Math.max(0, issues.openTotal - issues.nodes.filter((node) => !node.closedAt).length)
				: 0
		},
		prs: {
			total: !prs.complete ? Math.max(0, prs.total - prs.nodes.length) : 0,
			open: !prs.complete
				? Math.max(0, prs.openTotal - prs.nodes.filter((node) => !node.closedAt).length)
				: 0
		}
	};
	const initialOpen = {
		issues: baseline.issues.open,
		prs: baseline.prs.open
	};
	const core = buildTimeline(issueLife, prLife, sampled, initialOpen);
	return { ...core, resolution: buildResolution(issues.nodes, prs.nodes), baseline };
}

const key = (owner: string, name: string) =>
	`repo:timeline-state:v1:${owner}/${name}`.toLowerCase();
// One kind failing mid-refresh keeps the other's progress instead of blanking both
async function syncState(
	owner: string,
	name: string,
	current?: TimelineState
): Promise<TimelineState> {
	const [issues, prs] = await Promise.all([
		syncKind<IssueNode>(owner, name, 'issues', current?.issues).catch((caught) => {
			if (current) {
				logError('repo-timeline-issues', caught);
				return current.issues;
			}
			throw caught;
		}),
		syncKind<PrNode>(owner, name, 'pullRequests', current?.prs).catch((caught) => {
			if (current) {
				logError('repo-timeline-prs', caught);
				return current.prs;
			}
			throw caught;
		})
	]);
	return { issues, prs };
}

export const isRepoTimelineCached = (owner: string, name: string) => isCached(key(owner, name));

// Serve the last good timeline immediately, refreshing recent rows and resuming older
// history in the background. A cold repo fetches one bounded batch before first render
export async function getRepoIssuePrTimeline(owner: string, name: string): Promise<RepoTimeline> {
	const state = await checkpointed<TimelineState>(
		'repo-timeline',
		key(owner, name),
		TTL,
		(current) => syncState(owner, name, current)
	);
	return build(state);
}

// Crawl one more batch of older history on demand and persist it, so a signed-in viewer
// can progressively deepen the timeline past the background bound, cached for later viewers
export async function advanceRepoTimeline(owner: string, name: string): Promise<RepoTimeline> {
	const stored = await readCached<TimelineState>(key(owner, name));
	const current = stored?.value;
	// Fully crawled already, hand back what we have rather than refetch
	if (current && current.issues.complete && current.prs.complete) return build(current);
	return build(
		await advanceCheckpointed<TimelineState>(key(owner, name), TTL, (state) =>
			syncState(owner, name, state)
		)
	);
}
