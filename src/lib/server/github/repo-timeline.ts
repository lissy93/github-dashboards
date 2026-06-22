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
	openIssues: number;
	openedPrs: number;
	closedPrs: number;
	openPrs: number;
};
export type Granularity = 'month' | 'week';
export type RepoTimeline = {
	points: TimelinePoint[];
	sampled: boolean;
	granularity: Granularity;
};

type Dated = { createdAt: string; closedAt: string | null };
type Conn = { nodes: Dated[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
type TimelineResp = { repository: { issues?: Conn; pullRequests?: Conn } | null };

const query = (field: 'issues' | 'pullRequests') => `
	query RepoTimeline($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			${field}(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
				nodes { createdAt closedAt }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const ISSUE_QUERY = query('issues');
const PR_QUERY = query('pullRequests');

const pad = (value: number) => String(value).padStart(2, '0');
// Repos with under a year of history bucket by week, so the bars carry detail
const YEAR_MS = 365 * 86400000;

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
async function walk(
	owner: string,
	name: string,
	kind: 'issues' | 'pullRequests'
): Promise<{ nodes: Dated[]; sampled: boolean }> {
	const text = kind === 'issues' ? ISSUE_QUERY : PR_QUERY;
	const nodes: Dated[] = [];
	let cursor: string | null = null;
	let sampled = false;
	for (let page = 0; page < MAX_PAGES; page++) {
		const data: TimelineResp = await graphql<TimelineResp>(text, { owner, name, cursor });
		const conn: Conn | undefined = data.repository?.issues ?? data.repository?.pullRequests;
		if (!conn) break;
		nodes.push(...conn.nodes);
		if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
		cursor = conn.pageInfo.endCursor;
		if (page === MAX_PAGES - 1) sampled = true;
	}
	return { nodes, sampled };
}

// Tally opened and closed counts per bucket for one kind of item
function tally(
	nodes: Dated[],
	granularity: Granularity,
	opened: Map<string, number>,
	closed: Map<string, number>
) {
	for (const node of nodes) {
		const open = bucketStart(node.createdAt, granularity);
		opened.set(open, (opened.get(open) ?? 0) + 1);
		if (node.closedAt) {
			const close = bucketStart(node.closedAt, granularity);
			closed.set(close, (closed.get(close) ?? 0) + 1);
		}
	}
}

// Bucket created/closed dates into opened, closed and running open counts, weekly for
// young repos and monthly otherwise. Pure, so the GraphQL walk and the maths test apart
export function buildTimeline(issues: Dated[], prs: Dated[], sampled = false): RepoTimeline {
	const earliestIso = [...issues, ...prs].map((node) => node.createdAt).sort()[0];
	const granularity: Granularity =
		earliestIso && Date.now() - Date.parse(earliestIso) < YEAR_MS ? 'week' : 'month';
	if (!earliestIso) return { points: [], sampled, granularity };

	const openedIssues = new Map<string, number>();
	const closedIssues = new Map<string, number>();
	const openedPrs = new Map<string, number>();
	const closedPrs = new Map<string, number>();
	tally(issues, granularity, openedIssues, closedIssues);
	tally(prs, granularity, openedPrs, closedPrs);

	const buckets = bucketRange(bucketStart(earliestIso, granularity), granularity);

	let runningIssues = 0;
	let runningPrs = 0;
	const points = buckets.map((period) => {
		const oi = openedIssues.get(period) ?? 0;
		const ci = closedIssues.get(period) ?? 0;
		const op = openedPrs.get(period) ?? 0;
		const cp = closedPrs.get(period) ?? 0;
		runningIssues = Math.max(0, runningIssues + oi - ci);
		runningPrs = Math.max(0, runningPrs + op - cp);
		return {
			period,
			openedIssues: oi,
			closedIssues: ci,
			openIssues: runningIssues,
			openedPrs: op,
			closedPrs: cp,
			openPrs: runningPrs
		};
	});

	return { points, sampled, granularity };
}

async function build(owner: string, name: string): Promise<RepoTimeline> {
	const [issues, prs] = await Promise.all([
		walk(owner, name, 'issues'),
		walk(owner, name, 'pullRequests')
	]);
	return buildTimeline(issues.nodes, prs.nodes, issues.sampled || prs.sampled);
}

const key = (owner: string, name: string) => `repo:timeline:v2:${owner}/${name}`.toLowerCase();

export const isRepoTimelineCached = (owner: string, name: string) => isCached(key(owner, name));

// Open and closed issues and PRs bucketed by month, with the running open count.
// Derived from each item's created and closed dates, so history shows on first visit
export function getRepoIssuePrTimeline(owner: string, name: string): Promise<RepoTimeline> {
	return cached(key(owner, name), () => build(owner, name), TTL);
}
