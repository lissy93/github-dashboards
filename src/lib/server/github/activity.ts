import { and, asc, desc, eq, gt, ilike, lt, or, sql, type SQL } from 'drizzle-orm';
import { graphql, rest } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';
import { logError } from '$lib/errors';
import { db } from '$lib/server/db';
import { activityEvent } from '$lib/server/db/schema';
import {
	mapEvent,
	prToActivities,
	issueToActivities,
	encodeCursor,
	decodeCursor,
	type RawEvent,
	type BackfillItem
} from '$lib/server/github/activity-map';
import type { ActivityEvent, ActivityPage, ActivityType } from '$lib/types';

const PER_PAGE = 100;
const EVENT_PAGES = 3;
const BACKFILL_PAGES = 5;
const PAGE_SIZE = 40;
// Refresh newest on each visit, but throttle so navigation does not refetch
const SYNC_TTL = 120;
// Deep history is heavy, so reseed at most daily to refresh titles and new items
const BACKFILL_TTL = 86400;

// Store rows idempotently. Drops rows missing required columns, dedupes the
// batch, and fills title/body the thin events feed omits without clobbering
async function store(login: string, events: ActivityEvent[]): Promise<void> {
	const byId = new Map(
		events.filter((event) => event.id && event.url).map((event) => [event.id, event])
	);
	if (!byId.size) return;
	const rows = [...byId.values()].map((event) => ({
		...event,
		user: login.toLowerCase(),
		createdAt: new Date(event.createdAt)
	}));
	await db
		.insert(activityEvent)
		.values(rows)
		.onConflictDoUpdate({
			target: activityEvent.id,
			set: {
				title: sql`coalesce(${activityEvent.title}, excluded.title)`,
				body: sql`coalesce(${activityEvent.body}, excluded.body)`
			}
		});
}

// Walk up to EVENT_PAGES of the public events feed, mapping each to a row
async function fetchEvents(login: string): Promise<ActivityEvent[]> {
	const out: ActivityEvent[] = [];
	for (let page = 1; page <= EVENT_PAGES; page++) {
		const raw = await rest<RawEvent[]>(
			`/users/${login}/events/public?per_page=${PER_PAGE}&page=${page}`
		);
		if (!raw?.length) break;
		for (const event of raw) {
			const mapped = mapEvent(event);
			if (mapped) out.push(mapped);
		}
		if (raw.length < PER_PAGE) break;
	}
	return out;
}

// Refresh the newest events for a user, throttled and deduped against history
function syncEvents(login: string): Promise<{ stored: number }> {
	return cached(
		`activity:sync:${login.toLowerCase()}`,
		async () => {
			const events = await fetchEvents(login);
			await store(login, events);
			return { stored: events.length };
		},
		SYNC_TTL
	);
}

type Conn = { nodes: BackfillItem[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
type BackfillUser = { pullRequests?: Conn; issues?: Conn } | null;

const PR_QUERY = `
	query BackfillPRs($login: String!, $cursor: String) {
		user(login: $login) {
			pullRequests(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { number title url createdAt mergedAt closedAt repository { nameWithOwner } }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const ISSUE_QUERY = `
	query BackfillIssues($login: String!, $cursor: String) {
		user(login: $login) {
			issues(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { number title url createdAt closedAt repository { nameWithOwner } }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

// Page a single authored connection (PRs or issues) up to the backfill cap
async function fetchBackfill(
	login: string,
	query: string,
	pick: (user: BackfillUser) => Conn | undefined
): Promise<BackfillItem[]> {
	const items: BackfillItem[] = [];
	let cursor: string | null = null;
	for (let page = 0; page < BACKFILL_PAGES; page++) {
		const data = await graphql<{ user: BackfillUser }>(query, { login, cursor });
		const conn = pick(data.user);
		if (!conn) break;
		items.push(...conn.nodes);
		if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
		cursor = conn.pageInfo.endCursor;
	}
	return items;
}

// Seed deep history from authored PRs and issues, reseeded at most daily
function backfillActivity(login: string): Promise<{ stored: number }> {
	return cached(
		`activity:backfill:${login.toLowerCase()}`,
		async () => {
			const [prs, issues] = await Promise.all([
				fetchBackfill(login, PR_QUERY, (user) => user?.pullRequests),
				fetchBackfill(login, ISSUE_QUERY, (user) => user?.issues)
			]);
			const events = [...prs.flatMap(prToActivities), ...issues.flatMap(issueToActivities)];
			await store(login, events);
			return { stored: events.length };
		},
		BACKFILL_TTL
	);
}

// Best-effort refresh from GitHub. A failure here must never blank stored
// history, so the page always renders whatever getActivityPage returns
export async function ingestActivity(login: string): Promise<void> {
	const settled = await Promise.allSettled([syncEvents(login), backfillActivity(login)]);
	for (const result of settled)
		if (result.status === 'rejected') logError('activity-ingest', result.reason);
}

// Whether deep history has been seeded, so the page can render inline vs stream
export const isActivityReady = (login: string) =>
	isCached(`activity:backfill:${login.toLowerCase()}`);

function toEvent(row: typeof activityEvent.$inferSelect): ActivityEvent {
	return {
		id: row.id,
		type: row.type as ActivityType,
		action: row.action,
		createdAt: row.createdAt.toISOString(),
		repo: row.repo,
		title: row.title,
		body: row.body,
		url: row.url,
		payload: row.payload as Record<string, unknown> | null
	};
}

type PageOptions = {
	cursor?: string | null;
	type?: string | null;
	q?: string | null;
	dir?: string | null;
	limit?: number;
};

// Read one page from the store, with keyset paging, filters and time direction
export async function getActivityPage(
	login: string,
	options: PageOptions = {}
): Promise<ActivityPage> {
	const limit = Math.min(Math.max(options.limit ?? PAGE_SIZE, 1), 100);
	const ascending = options.dir === 'asc';
	const conditions: SQL[] = [eq(activityEvent.user, login.toLowerCase())];

	if (options.type) conditions.push(eq(activityEvent.type, options.type));
	if (options.q) {
		// Escape LIKE wildcards so a literal % or _ in the query stays literal
		const like = `%${options.q.replace(/[\\%_]/g, '\\$&')}%`;
		conditions.push(
			or(
				ilike(activityEvent.repo, like),
				ilike(activityEvent.title, like),
				ilike(activityEvent.body, like)
			)!
		);
	}

	const cursor = options.cursor ? decodeCursor(options.cursor) : null;
	if (cursor) {
		const at = new Date(cursor.createdAt);
		const after = ascending ? gt : lt;
		conditions.push(
			or(
				after(activityEvent.createdAt, at),
				and(eq(activityEvent.createdAt, at), after(activityEvent.id, cursor.id))
			)!
		);
	}

	const order = ascending
		? [asc(activityEvent.createdAt), asc(activityEvent.id)]
		: [desc(activityEvent.createdAt), desc(activityEvent.id)];
	const rows = await db
		.select()
		.from(activityEvent)
		.where(and(...conditions))
		.orderBy(...order)
		.limit(limit + 1);

	const events = rows.slice(0, limit).map(toEvent);
	const nextCursor = rows.length > limit ? encodeCursor(events[events.length - 1]) : null;
	return { events, nextCursor };
}
