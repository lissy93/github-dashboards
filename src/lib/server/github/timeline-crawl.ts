import { paginate, type Conn } from '$lib/server/github/client';
import { logError } from '$lib/utils/errors';

const PER_PAGE = 100;
// Older-history pages fetched per sync round, a cold crawl uses the same depth
export const BACKFILL_PAGES = 10;
// Changed-item sweep depth once a watermark exists, one page usually covers a visit gap
const SWEEP_PAGES = 3;

export type CrawlOrder = 'CREATED_AT' | 'UPDATED_AT';
export type CrawlKind = 'issues' | 'pullRequests';

// A resumable per-kind crawl: the nodes gathered so far plus the cursor to resume older
// history, with the live totals used to size the still-uncrawled baseline
export type Crawl<T> = {
	nodes: T[];
	cursor: string | null;
	complete: boolean;
	total: number;
	openTotal: number;
	syncedAt?: string;
};
export type CrawlState<I, P> = { issues: Crawl<I>; prs: Crawl<P> };

// The GraphQL root owning the issue/PR connections (a repository or a user) and how to
// query it, so one crawl engine serves both repo timelines and user contributions
export type CrawlSource = {
	root: string;
	args: string;
	params: string;
	variables: Record<string, string>;
	fields: Record<CrawlKind, string>;
};

type Updated = { updatedAt: string };
type CrawlConn<T> = Conn<T> & { totalCount: number };
type CrawlRoot<T> = { open: { totalCount: number } } & Partial<Record<CrawlKind, CrawlConn<T>>>;
type RootData<T> = Record<string, CrawlRoot<T> | null>;

const query = (source: CrawlSource, field: CrawlKind, order: CrawlOrder) => `
	query TimelineCrawl($cursor: String, ${source.params}) {
		${source.root}(${source.args}) {
			${field}(first: ${PER_PAGE}, after: $cursor, orderBy: { field: ${order}, direction: DESC }) {
				totalCount
				nodes { ${source.fields[field]}${order === 'UPDATED_AT' ? ' updatedAt' : ''} }
				pageInfo { hasNextPage endCursor }
			}
			open: ${field}(states: OPEN) { totalCount }
		}
	}
`;

type BatchOptions<T> = {
	pages: number;
	cursor?: string | null;
	order?: CrawlOrder;
	until?: (page: T[]) => boolean;
};

// Fetch one bounded batch, returning the cursor needed to resume older history
async function fetchBatch<T extends { id: string }>(
	source: CrawlSource,
	kind: CrawlKind,
	options: BatchOptions<T>
): Promise<Crawl<T>> {
	let openTotal = 0;
	let total = 0;
	const { nodes, cursor, complete } = await paginate<T, RootData<T>>(
		query(source, kind, options.order ?? 'CREATED_AT'),
		source.variables,
		(data) => {
			const conn = data[source.root]?.[kind];
			if (conn) {
				openTotal = data[source.root]?.open.totalCount ?? 0;
				total = conn.totalCount;
			}
			return conn;
		},
		{ maxPages: options.pages, cursor: options.cursor, until: options.until }
	);
	return { nodes, cursor, complete, openTotal, total };
}

// Re-fetch items changed since the watermark, newest change first, so items closed,
// merged or reopened while cached get their stored lifecycle corrected. New items surface
// here too. A state from before watermarks existed gets one deeper catch-up sweep
async function fetchUpdatedBatch<T extends { id: string }>(
	source: CrawlSource,
	kind: CrawlKind,
	since?: string
): Promise<Crawl<T>> {
	const batch = await fetchBatch<T & Updated>(source, kind, {
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
async function syncKind<T extends { id: string }>(
	source: CrawlSource,
	kind: CrawlKind,
	current?: Crawl<T>
): Promise<Crawl<T>> {
	const syncedAt = new Date().toISOString();
	if (!current) {
		return { ...(await fetchBatch<T>(source, kind, { pages: BACKFILL_PAGES })), syncedAt };
	}

	const updated = await fetchUpdatedBatch<T>(source, kind, current.syncedAt);
	if (current.complete) {
		return {
			...current,
			nodes: merge(current.nodes, updated.nodes),
			total: updated.total,
			openTotal: updated.openTotal,
			syncedAt
		};
	}

	const older = await fetchBatch<T>(source, kind, {
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

// Crawl both kinds together. One kind failing mid-refresh keeps the other's progress
// instead of blanking both, but a cold crawl has no prior state to fall back on so it throws
export async function syncCrawl<I extends { id: string }, P extends { id: string }>(
	source: CrawlSource,
	scope: string,
	current?: CrawlState<I, P>
): Promise<CrawlState<I, P>> {
	const [issues, prs] = await Promise.all([
		syncKind<I>(source, 'issues', current?.issues).catch((caught) => {
			if (current) {
				logError(`${scope}-issues`, caught);
				return current.issues;
			}
			throw caught;
		}),
		syncKind<P>(source, 'pullRequests', current?.prs).catch((caught) => {
			if (current) {
				logError(`${scope}-prs`, caught);
				return current.prs;
			}
			throw caught;
		})
	]);
	return { issues, prs };
}
