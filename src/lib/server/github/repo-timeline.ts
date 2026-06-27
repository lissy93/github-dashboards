import { graphql } from '$lib/server/github/client';
import { isCached, readCached, writeCached } from '$lib/server/cache';
import { logError } from '$lib/errors';

// Refresh the newest data often, while each refresh resumes a bounded older backfill
const TTL = 300;
const PER_PAGE = 100;
const BACKFILL_PAGES = 10;

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

const query = (field: 'issues' | 'pullRequests', nodeFields: string) => `
	query RepoTimeline($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			${field}(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				totalCount
				nodes { ${nodeFields} }
				pageInfo { hasNextPage endCursor }
			}
			open: ${field}(states: OPEN) { totalCount }
		}
	}
`;

const ISSUE_QUERY = query('issues', 'id createdAt closedAt stateReason');
const PR_QUERY = query('pullRequests', 'id createdAt closedAt merged');

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

// Middle value of a set, averaging the two middles for an even count
function median(values: number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((first, second) => first - second);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

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
	const date = new Date(iso);
	if (granularity === 'week') {
		const offset = (date.getUTCDay() + 6) % 7;
		const monday = new Date(
			Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset)
		);
		return monday.toISOString().slice(0, 10);
	}
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`;
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
};
type TimelineState = { issues: Crawl<IssueNode>; prs: Crawl<PrNode> };

// Fetch one bounded batch, returning the cursor needed to resume older history
async function fetchBatch<T extends Lifecycle & { id: string }>(
	owner: string,
	name: string,
	kind: 'issues' | 'pullRequests',
	startCursor: string | null,
	pages: number
): Promise<Crawl<T>> {
	const text = kind === 'issues' ? ISSUE_QUERY : PR_QUERY;
	const nodes: T[] = [];
	let cursor = startCursor;
	let complete = false;
	let openTotal = 0;
	let total = 0;
	for (let page = 0; page < pages; page++) {
		const data: TimelineResp<T> = await graphql<TimelineResp<T>>(text, { owner, name, cursor });
		const conn: Conn<T> | undefined = data.repository?.[kind];
		if (!conn) {
			complete = true;
			break;
		}
		openTotal = data.repository?.open.totalCount ?? 0;
		total = conn.totalCount;
		nodes.push(...conn.nodes);
		if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) {
			cursor = null;
			complete = true;
			break;
		}
		cursor = conn.pageInfo.endCursor;
	}
	return { nodes, cursor, complete, openTotal, total };
}

// Merge refreshed rows by GitHub id, preferring the newest state for reopened items
function merge<T extends { id: string }>(...groups: T[][]): T[] {
	return [...new Map(groups.flat().map((node) => [node.id, node])).values()];
}

async function syncKind<T extends Lifecycle & { id: string }>(
	owner: string,
	name: string,
	kind: 'issues' | 'pullRequests',
	current?: Crawl<T>
): Promise<Crawl<T>> {
	if (!current) return fetchBatch(owner, name, kind, null, BACKFILL_PAGES);

	const latest = await fetchBatch<T>(owner, name, kind, null, 1);
	if (current.complete) {
		return {
			...current,
			nodes: merge(current.nodes, latest.nodes),
			total: latest.total,
			openTotal: latest.openTotal
		};
	}

	const older = await fetchBatch<T>(owner, name, kind, current.cursor, BACKFILL_PAGES);
	return {
		nodes: merge(current.nodes, latest.nodes, older.nodes),
		cursor: older.cursor,
		complete: older.complete,
		total: latest.total,
		openTotal: latest.openTotal
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
const syncing = new Map<string, Promise<TimelineState>>();

async function syncState(
	owner: string,
	name: string,
	current?: TimelineState
): Promise<TimelineState> {
	const cacheKey = key(owner, name);
	const running = syncing.get(cacheKey);
	if (running) return running;

	const task = Promise.all([
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
	])
		.then(async ([issues, prs]) => {
			const state = { issues, prs };
			try {
				await writeCached(cacheKey, state, TTL);
			} catch (caught) {
				logError('repo-timeline-cache', caught);
			}
			return state;
		})
		.finally(() => syncing.delete(cacheKey));

	syncing.set(cacheKey, task);
	return task;
}

export const isRepoTimelineCached = (owner: string, name: string) => isCached(key(owner, name));

// Serve the last good timeline immediately, refreshing recent rows and resuming older
// history in the background. A cold repo fetches one bounded batch before first render
export async function getRepoIssuePrTimeline(owner: string, name: string): Promise<RepoTimeline> {
	const cacheKey = key(owner, name);
	let stored: Awaited<ReturnType<typeof readCached<TimelineState>>> = null;
	try {
		stored = await readCached<TimelineState>(cacheKey);
	} catch (caught) {
		logError('repo-timeline-cache', caught);
	}
	if (!stored) return build(await syncState(owner, name));

	const stale = Date.now() - stored.fetchedAt.getTime() >= TTL * 1000;
	if (stale) {
		void syncState(owner, name, stored.value).catch((caught) =>
			logError('repo-timeline-refresh', caught)
		);
	}
	return build(stored.value);
}
