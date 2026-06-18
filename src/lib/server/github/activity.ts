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
	discussionToActivity,
	discussionCommentToActivity,
	commentToActivity,
	commitCommentToActivity,
	reviewToActivity,
	encodeCursor,
	decodeCursor,
	type RawEvent,
	type BackfillItem,
	type DiscussionItem,
	type DiscussionCommentItem,
	type CommentItem,
	type CommitCommentItem,
	type ReviewItem
} from '$lib/server/github/activity-map';
import type { ActivityEvent, ActivityPage, ActivityType, Reactions } from '$lib/types';

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
				body: sql`coalesce(${activityEvent.body}, excluded.body)`,
				reactions: sql`coalesce(excluded.reactions, ${activityEvent.reactions})`
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
export function syncActivity(login: string): Promise<{ stored: number }> {
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

type Conn<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };

const PR_QUERY = `
	query BackfillPRs($login: String!, $cursor: String) {
		user(login: $login) {
			pullRequests(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { number title url createdAt mergedAt closedAt repository { nameWithOwner } reactionGroups { content reactors { totalCount } } }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const ISSUE_QUERY = `
	query BackfillIssues($login: String!, $cursor: String) {
		user(login: $login) {
			issues(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { number title url createdAt closedAt repository { nameWithOwner } reactionGroups { content reactors { totalCount } } }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const DISCUSSION_QUERY = `
	query BackfillDiscussions($login: String!, $cursor: String) {
		user(login: $login) {
			repositoryDiscussions(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { number title url createdAt repository { nameWithOwner } reactionGroups { content reactors { totalCount } } }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

// This connection has no orderBy, so page backwards to get the newest first,
// aliasing the cursor fields so the shared pager reads them the same way
const DISCUSSION_COMMENT_QUERY = `
	query BackfillDiscussionComments($login: String!, $cursor: String) {
		user(login: $login) {
			repositoryDiscussionComments(last: ${PER_PAGE}, before: $cursor) {
				nodes { url createdAt bodyText discussion { number title repository { nameWithOwner } } reactionGroups { content reactors { totalCount } } }
				pageInfo { hasNextPage: hasPreviousPage endCursor: startCursor }
			}
		}
	}
`;

const COMMENT_QUERY = `
	query BackfillComments($login: String!, $cursor: String) {
		user(login: $login) {
			issueComments(first: ${PER_PAGE}, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
				nodes { url createdAt bodyText issue { number title repository { nameWithOwner } } reactionGroups { content reactors { totalCount } } }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

// Commit comments have no orderBy, so page backwards for newest first (see above)
const COMMIT_COMMENT_QUERY = `
	query BackfillCommitComments($login: String!, $cursor: String) {
		user(login: $login) {
			commitComments(last: ${PER_PAGE}, before: $cursor) {
				nodes { url createdAt bodyText repository { nameWithOwner } reactionGroups { content reactors { totalCount } } }
				pageInfo { hasNextPage: hasPreviousPage endCursor: startCursor }
			}
		}
	}
`;

// Reviews live under contributionsCollection, which spans the last year only
const REVIEW_QUERY = `
	query BackfillReviews($login: String!) {
		user(login: $login) {
			contributionsCollection {
				pullRequestReviewContributions(first: ${PER_PAGE}) {
					nodes { occurredAt pullRequestReview { url state bodyText pullRequest { number title repository { nameWithOwner } } } }
				}
			}
		}
	}
`;

// Page one authored connection up to the backfill cap, keyed by its field name
async function fetchBackfill<Node>(login: string, query: string, field: string): Promise<Node[]> {
	const items: Node[] = [];
	let cursor: string | null = null;
	for (let page = 0; page < BACKFILL_PAGES; page++) {
		const data: { user: Record<string, Conn<Node>> | null } = await graphql(query, {
			login,
			cursor
		});
		const conn = data.user?.[field];
		if (!conn) break;
		items.push(...conn.nodes);
		if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
		cursor = conn.pageInfo.endCursor;
	}
	return items;
}

// One bounded page of the last year of submitted reviews, dropping deleted ones
async function fetchReviews(login: string): Promise<ReviewItem[]> {
	type Data = {
		user: {
			contributionsCollection: { pullRequestReviewContributions: { nodes: ReviewItem[] } };
		} | null;
	};
	const data: Data = await graphql(REVIEW_QUERY, { login });
	const nodes = data.user?.contributionsCollection.pullRequestReviewContributions.nodes ?? [];
	return nodes.filter((node) => node.pullRequestReview);
}

// Run one backfill source, never rejecting so a single flaky connection can not
// waste the others nor force the whole backfill to re-run on the next scroll
async function source<T>(label: string, fetch: () => Promise<T[]>): Promise<T[]> {
	try {
		return await fetch();
	} catch (caught) {
		logError(`activity-backfill:${label}`, caught);
		return [];
	}
}

// Seed deep history from authored PRs, issues, discussions, comments and reviews,
// reseeded daily. Heavy, so it runs lazily once a user scrolls, not on page load
export function backfillActivity(login: string): Promise<{ stored: number }> {
	return cached(
		`activity:backfill:${login.toLowerCase()}`,
		async () => {
			const [prs, issues, discussions, discComments, comments, commitComments, reviews] =
				await Promise.all([
					source('prs', () => fetchBackfill<BackfillItem>(login, PR_QUERY, 'pullRequests')),
					source('issues', () => fetchBackfill<BackfillItem>(login, ISSUE_QUERY, 'issues')),
					source('discussions', () =>
						fetchBackfill<DiscussionItem>(login, DISCUSSION_QUERY, 'repositoryDiscussions')
					),
					source('discussion-comments', () =>
						fetchBackfill<DiscussionCommentItem>(
							login,
							DISCUSSION_COMMENT_QUERY,
							'repositoryDiscussionComments'
						)
					),
					source('comments', () =>
						fetchBackfill<CommentItem>(login, COMMENT_QUERY, 'issueComments')
					),
					source('commit-comments', () =>
						fetchBackfill<CommitCommentItem>(login, COMMIT_COMMENT_QUERY, 'commitComments')
					),
					source('reviews', () => fetchReviews(login))
				]);
			const events = [
				...prs.flatMap(prToActivities),
				...issues.flatMap(issueToActivities),
				...discussions.map(discussionToActivity),
				...discComments.map(discussionCommentToActivity),
				...comments.map(commentToActivity),
				...commitComments.map(commitCommentToActivity),
				...reviews.map(reviewToActivity)
			];
			await store(login, events);
			return { stored: events.length };
		},
		BACKFILL_TTL
	);
}

// Whether this user has been synced before, so the page renders inline vs streams
export const isSynced = (login: string) => isCached(`activity:sync:${login.toLowerCase()}`);

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
		payload: row.payload as Record<string, unknown> | null,
		reactions: row.reactions as Reactions | null
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
