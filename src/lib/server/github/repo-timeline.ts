import { graphql } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';

// Slow moving aggregate, so cache it longer than the live open lists
const TTL = 6 * 3600;
const PER_PAGE = 100;
// Bound the walk so a huge repo still costs a handful of queries
const MAX_PAGES = 10;

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

export type RepoTimeline = TimelineCore & { resolution: RepoResolution };

// A created/closed item, resolved means merged (PR) or completed (issue), default true
export type Lifecycle = { createdAt: string; closedAt: string | null; resolved?: boolean };

type IssueNode = { createdAt: string; closedAt: string | null; stateReason: string | null };
type PrNode = { createdAt: string; closedAt: string | null; merged: boolean };
type Conn<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
type TimelineResp<T> = { repository: Record<string, Conn<T>> | null };

const query = (field: 'issues' | 'pullRequests', nodeFields: string) => `
	query RepoTimeline($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			${field}(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
				nodes { ${nodeFields} }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const ISSUE_QUERY = query('issues', 'createdAt closedAt stateReason');
const PR_QUERY = query('pullRequests', 'createdAt closedAt merged');

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
	if (!hours.length) return { count: 0, medianHours: null, buckets };
	const sorted = [...hours].sort((first, second) => first - second);
	const mid = Math.floor(sorted.length / 2);
	const medianHours = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
	return { count: hours.length, medianHours, buckets };
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

// Walk one connection (issues or PRs) of created/closed dates up to the page cap
async function walk<T>(
	owner: string,
	name: string,
	kind: 'issues' | 'pullRequests'
): Promise<{ nodes: T[]; sampled: boolean }> {
	const text = kind === 'issues' ? ISSUE_QUERY : PR_QUERY;
	const nodes: T[] = [];
	let cursor: string | null = null;
	let sampled = false;
	for (let page = 0; page < MAX_PAGES; page++) {
		const data: TimelineResp<T> = await graphql<TimelineResp<T>>(text, { owner, name, cursor });
		const conn: Conn<T> | undefined = data.repository?.[kind];
		if (!conn) break;
		nodes.push(...conn.nodes);
		if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
		cursor = conn.pageInfo.endCursor;
		if (page === MAX_PAGES - 1) sampled = true;
	}
	return { nodes, sampled };
}

// Tally opened counts, and closed counts split by whether each item was resolved
function tally(
	nodes: Lifecycle[],
	granularity: Granularity,
	opened: Map<string, number>,
	resolved: Map<string, number>,
	discarded: Map<string, number>
) {
	for (const node of nodes) {
		const open = bucketStart(node.createdAt, granularity);
		opened.set(open, (opened.get(open) ?? 0) + 1);
		if (node.closedAt) {
			const close = bucketStart(node.closedAt, granularity);
			const target = node.resolved === false ? discarded : resolved;
			target.set(close, (target.get(close) ?? 0) + 1);
		}
	}
}

// Bucket created/closed dates into opened, closed and running open counts, weekly for
// young repos and monthly otherwise. Closed counts split into resolved (merged/completed)
// and discarded (closed/not planned). Pure, so the GraphQL walk and the maths test apart
export function buildTimeline(
	issues: Lifecycle[],
	prs: Lifecycle[],
	sampled = false
): TimelineCore {
	const earliestIso = [...issues, ...prs].map((node) => node.createdAt).sort()[0];
	const granularity: Granularity =
		earliestIso && Date.now() - Date.parse(earliestIso) < YEAR_MS ? 'week' : 'month';
	if (!earliestIso) return { points: [], sampled, granularity };

	const openedIssues = new Map<string, number>();
	const completedIssues = new Map<string, number>();
	const discardedIssues = new Map<string, number>();
	const openedPrs = new Map<string, number>();
	const mergedPrs = new Map<string, number>();
	const discardedPrs = new Map<string, number>();
	tally(issues, granularity, openedIssues, completedIssues, discardedIssues);
	tally(prs, granularity, openedPrs, mergedPrs, discardedPrs);

	const buckets = bucketRange(bucketStart(earliestIso, granularity), granularity);

	let runningIssues = 0;
	let runningPrs = 0;
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
			openPrs: runningPrs
		};
	});

	return { points, sampled, granularity };
}

async function build(owner: string, name: string): Promise<RepoTimeline> {
	const [issues, prs] = await Promise.all([
		walk<IssueNode>(owner, name, 'issues'),
		walk<PrNode>(owner, name, 'pullRequests')
	]);
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
	const core = buildTimeline(issueLife, prLife, issues.sampled || prs.sampled);
	return { ...core, resolution: buildResolution(issues.nodes, prs.nodes) };
}

const key = (owner: string, name: string) => `repo:timeline:v4:${owner}/${name}`.toLowerCase();

export const isRepoTimelineCached = (owner: string, name: string) => isCached(key(owner, name));

// Open and closed issues and PRs bucketed by month, with the running open count and the
// merged-versus-closed split. Derived from each item's dates, so history shows on first visit
export function getRepoIssuePrTimeline(owner: string, name: string): Promise<RepoTimeline> {
	return cached(key(owner, name), () => build(owner, name), TTL);
}
