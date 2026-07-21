import { and, asc, desc, eq, gt, ilike, lt, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { graphql, rest, paginate } from '$lib/server/github/client';
import { getRepo } from '$lib/server/github/repo';
import { buildPunchCard } from '$lib/utils/punch-card';
import { cached, isCached, readCached, writeCached } from '$lib/server/cache';
import { logError, rootReason } from '$lib/utils/errors';
import { createLogger } from '$lib/utils/logger';
import { db } from '$lib/server/db';
import { activityEvent } from '$lib/server/db/schema';
import { getUserContributions } from '$lib/server/github/user-stats';
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
import type {
	ActivityEvent,
	ActivityPage,
	ActivityRhythm,
	ActivityType,
	RepoActivityMonths,
	Reactions
} from '$lib/types';

const log = createLogger('activity');

const PER_PAGE = 100;
const EVENT_PAGES = 3;
const BACKFILL_PAGES = 5;
const PAGE_SIZE = 40;
// Refresh newest on each visit, but throttle so navigation does not refetch
const SYNC_TTL = 120;
// Deep history is heavy, so reseed at most daily to refresh titles and new items
const BACKFILL_TTL = 86400;

// Store valid rows once and fill details the event feed omits
async function store(login: string, events: ActivityEvent[]): Promise<void> {
	const byId = new Map(
		events.filter((event) => event.id && event.url).map((event) => [event.id, event])
	);
	if (!byId.size) return;
	const rows = [...byId.values()].map((event) => ({
		...event,
		user: (event.actor ?? login).toLowerCase(),
		createdAt: new Date(event.createdAt)
	}));
	try {
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
	} catch (error) {
		// Events refetch on the next visit, a failed persist must not sink the page
		log.warn(`could not store events for ${login}`, { reason: rootReason(error) });
	}
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

// Walk the repo events feed, capturing each event's actor for multi-user attribution
async function fetchRepoEvents(owner: string, repo: string): Promise<ActivityEvent[]> {
	const out: ActivityEvent[] = [];
	for (let page = 1; page <= EVENT_PAGES; page++) {
		const raw = await rest<RawEvent[]>(
			`/repos/${owner}/${repo}/events?per_page=${PER_PAGE}&page=${page}`
		);
		if (!raw?.length) break;
		for (const event of raw) {
			const mapped = mapEvent(event);
			if (mapped) {
				mapped.actor = event.actor?.login ?? null;
				out.push(mapped);
			}
		}
		if (raw.length < PER_PAGE) break;
	}
	return out;
}

// The stored events feed public pages, so private repos must never land in the store
async function repoIsPublic(owner: string, repo: string): Promise<boolean> {
	const meta = await getRepo(owner, repo);
	return !!meta && !meta.isPrivate;
}

// Refresh the newest repo-wide events, throttled per repo
export function syncRepoActivity(owner: string, repo: string): Promise<{ stored: number }> {
	const fullName = `${owner}/${repo}`;
	return cached(
		`activity:repo-sync:${fullName.toLowerCase()}`,
		async () => {
			if (!(await repoIsPublic(owner, repo))) return { stored: 0 };
			const events = await fetchRepoEvents(owner, repo);
			await store(owner, events);
			return { stored: events.length };
		},
		SYNC_TTL
	);
}

type Conn<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
type BackfillProgress = { cursor: string | null; complete: boolean };
type BackfillState = Record<string, BackfillProgress>;

// Reaction tallies, requested identically by every backfill query
const REACTIONS = 'reactionGroups { content reactors { totalCount } }';

const PR_QUERY = `
	query BackfillPRs($login: String!, $cursor: String) {
		user(login: $login) {
			pullRequests(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { number title url createdAt mergedAt closedAt repository { nameWithOwner } ${REACTIONS} }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const ISSUE_QUERY = `
	query BackfillIssues($login: String!, $cursor: String) {
		user(login: $login) {
			issues(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { number title url createdAt closedAt repository { nameWithOwner } ${REACTIONS} }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const DISCUSSION_QUERY = `
	query BackfillDiscussions($login: String!, $cursor: String) {
		user(login: $login) {
			repositoryDiscussions(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { number title url createdAt repository { nameWithOwner } ${REACTIONS} }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

// Page backwards where GitHub offers no ordering
const DISCUSSION_COMMENT_QUERY = `
	query BackfillDiscussionComments($login: String!, $cursor: String) {
		user(login: $login) {
			repositoryDiscussionComments(last: ${PER_PAGE}, before: $cursor) {
				nodes { url createdAt bodyText discussion { number title repository { nameWithOwner } } ${REACTIONS} }
				pageInfo { hasNextPage: hasPreviousPage endCursor: startCursor }
			}
		}
	}
`;

const COMMENT_QUERY = `
	query BackfillComments($login: String!, $cursor: String) {
		user(login: $login) {
			issueComments(first: ${PER_PAGE}, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
				nodes { url createdAt bodyText issue { number title repository { nameWithOwner } } ${REACTIONS} }
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
				nodes { url createdAt bodyText repository { nameWithOwner } ${REACTIONS} }
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
async function fetchBackfill<Node>(
	root: 'user' | 'repository',
	variables: Record<string, unknown>,
	query: string,
	field: string,
	cursor: string | null,
	pages: number
): Promise<{ items: Node[]; progress: BackfillProgress }> {
	const result = await paginate<Node, Record<string, Record<string, Conn<Node>> | null>>(
		query,
		variables,
		(data) => data[root]?.[field],
		{ maxPages: pages, cursor }
	);
	return { items: result.nodes, progress: { cursor: result.cursor, complete: result.complete } };
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

// Isolate backfill sources so one failure does not waste the others
async function source<T>(
	label: string,
	fetch: () => Promise<{ items: T[]; progress: BackfillProgress }>,
	fallback: BackfillProgress
): Promise<{ items: T[]; progress: BackfillProgress }> {
	try {
		return await fetch();
	} catch (caught) {
		logError(`activity-backfill:${label}`, caught);
		return { items: [], progress: fallback };
	}
}

const backfillKey = (login: string) => `activity:backfill-state:v1:${login.toLowerCase()}`;
const backfilling = new Map<string, Promise<{ stored: number }>>();

// Resume or start one backfill source: refresh the newest page, then walk older pages
async function backfillSource<T>(
	root: 'user' | 'repository',
	variables: Record<string, unknown>,
	query: string,
	field: string,
	progress: BackfillProgress
): Promise<{ items: T[]; progress: BackfillProgress }> {
	if (!progress.cursor && !progress.complete) {
		return fetchBackfill<T>(root, variables, query, field, null, BACKFILL_PAGES);
	}
	const latest = await fetchBackfill<T>(root, variables, query, field, null, 1);
	if (progress.complete) return { items: latest.items, progress };
	const older = await fetchBackfill<T>(
		root,
		variables,
		query,
		field,
		progress.cursor,
		BACKFILL_PAGES
	);
	return { items: [...latest.items, ...older.items], progress: older.progress };
}

// Refresh newest authored activity and resume older source cursors in bounded batches
export async function backfillActivity(login: string): Promise<{ stored: number }> {
	const cacheKey = backfillKey(login);
	const running = backfilling.get(cacheKey);
	if (running) return running;

	const task = (async () => {
		const stored = await readCached<BackfillState>(cacheKey).catch(() => null);
		if (stored && Date.now() - stored.fetchedAt.getTime() < BACKFILL_TTL * 1000) {
			return { stored: 0 };
		}
		const current = stored?.value ?? {};
		const pending = (field: string) => current[field] ?? { cursor: null, complete: false };
		const [prs, issues, discussions, discComments, comments, commitComments, reviews] =
			await Promise.all([
				source(
					'prs',
					() =>
						backfillSource<BackfillItem>(
							'user',
							{ login },
							PR_QUERY,
							'pullRequests',
							pending('prs')
						),
					pending('prs')
				),
				source(
					'issues',
					() =>
						backfillSource<BackfillItem>(
							'user',
							{ login },
							ISSUE_QUERY,
							'issues',
							pending('issues')
						),
					pending('issues')
				),
				source(
					'discussions',
					() =>
						backfillSource<DiscussionItem>(
							'user',
							{ login },
							DISCUSSION_QUERY,
							'repositoryDiscussions',
							pending('discussions')
						),
					pending('discussions')
				),
				source(
					'discussion-comments',
					() =>
						backfillSource<DiscussionCommentItem>(
							'user',
							{ login },
							DISCUSSION_COMMENT_QUERY,
							'repositoryDiscussionComments',
							pending('discussion-comments')
						),
					pending('discussion-comments')
				),
				source(
					'comments',
					() =>
						backfillSource<CommentItem>(
							'user',
							{ login },
							COMMENT_QUERY,
							'issueComments',
							pending('comments')
						),
					pending('comments')
				),
				source(
					'commit-comments',
					() =>
						backfillSource<CommitCommentItem>(
							'user',
							{ login },
							COMMIT_COMMENT_QUERY,
							'commitComments',
							pending('commit-comments')
						),
					pending('commit-comments')
				),
				fetchReviews(login).catch((caught) => {
					logError('activity-backfill:reviews', caught);
					return [];
				})
			]);
		const events = [
			...prs.items.flatMap(prToActivities),
			...issues.items.flatMap(issueToActivities),
			...discussions.items.map(discussionToActivity),
			...discComments.items.map(discussionCommentToActivity),
			...comments.items.map(commentToActivity),
			...commitComments.items.map(commitCommentToActivity),
			...reviews.map(reviewToActivity)
		];
		await store(login, events);
		await writeCached(
			cacheKey,
			{
				prs: prs.progress,
				issues: issues.progress,
				discussions: discussions.progress,
				'discussion-comments': discComments.progress,
				comments: comments.progress,
				'commit-comments': commitComments.progress
			},
			BACKFILL_TTL
		);
		return { stored: events.length };
	})().finally(() => backfilling.delete(cacheKey));

	backfilling.set(cacheKey, task);
	return task;
}

// Repo-scoped backfill: fetch historical PRs and issues with author attribution
type RepoBackfillItem = BackfillItem & { author?: { login: string } | null };

const REPO_PR_QUERY = `
	query RepoBackfillPRs($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			pullRequests(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { number title url createdAt mergedAt closedAt repository { nameWithOwner } author { login } ${REACTIONS} }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const REPO_ISSUE_QUERY = `
	query RepoBackfillIssues($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			issues(first: ${PER_PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { number title url createdAt closedAt repository { nameWithOwner } author { login } ${REACTIONS} }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

const repoBackfilling = new Map<string, Promise<{ stored: number }>>();

// Backfill all PRs and issues for a repo with per-event author attribution
export async function backfillRepoActivity(
	owner: string,
	repo: string
): Promise<{ stored: number }> {
	const fullName = `${owner}/${repo}`;
	const cacheKey = `activity:repo-backfill-state:v1:${fullName.toLowerCase()}`;
	const running = repoBackfilling.get(cacheKey);
	if (running) return running;

	const task = (async () => {
		if (!(await repoIsPublic(owner, repo))) return { stored: 0 };
		const stored = await readCached<BackfillState>(cacheKey).catch(() => null);
		if (stored && Date.now() - stored.fetchedAt.getTime() < BACKFILL_TTL * 1000) {
			return { stored: 0 };
		}
		const current = stored?.value ?? {};
		const pending = (field: string) => current[field] ?? { cursor: null, complete: false };
		const [prs, issues] = await Promise.all([
			source(
				'repo-prs',
				() =>
					backfillSource<RepoBackfillItem>(
						'repository',
						{ owner, name: repo },
						REPO_PR_QUERY,
						'pullRequests',
						pending('prs')
					),
				pending('prs')
			),
			source(
				'repo-issues',
				() =>
					backfillSource<RepoBackfillItem>(
						'repository',
						{ owner, name: repo },
						REPO_ISSUE_QUERY,
						'issues',
						pending('issues')
					),
				pending('issues')
			)
		]);
		const events: ActivityEvent[] = [];
		for (const pr of prs.items) {
			const mapped = prToActivities(pr);
			for (const e of mapped) e.actor = pr.author?.login ?? null;
			events.push(...mapped);
		}
		for (const issue of issues.items) {
			const mapped = issueToActivities(issue);
			for (const e of mapped) e.actor = issue.author?.login ?? null;
			events.push(...mapped);
		}
		await store(owner, events);
		await writeCached(cacheKey, { prs: prs.progress, issues: issues.progress }, BACKFILL_TTL);
		return { stored: events.length };
	})().finally(() => repoBackfilling.delete(cacheKey));

	repoBackfilling.set(cacheKey, task);
	return task;
}

// Whether this user has been synced before, so the page renders inline vs streams
export const isSynced = (login: string) => isCached(`activity:sync:${login.toLowerCase()}`);

// Same gate for repo-wide feeds
export const isRepoSynced = (owner: string, repo: string) =>
	isCached(`activity:repo-sync:${owner}/${repo}`.toLowerCase());

// Refreshed hourly, the heavy backfill behind it is itself cached for a day
const RHYTHM_TTL = 3600;

const rhythmKey = (login: string) => `activity:rhythm:v1:${login.toLowerCase()}`;

// Whether the rhythm is built, so the stats page renders inline vs streams
export const isRhythmReady = (login: string) => isCached(rhythmKey(login));

// Hour and weekday converted to UTC so the rhythm is timezone-stable
const utc = (part: string) =>
	sql<number>`extract(${sql.raw(part)} from (${activityEvent.createdAt} at time zone 'UTC'))::int`;

// Build the weekday-by-hour punch card from tracked activity
export function getActivityRhythm(login: string): Promise<ActivityRhythm> {
	return cached(
		rhythmKey(login),
		async () => {
			await Promise.allSettled([syncActivity(login), backfillActivity(login)]);
			const rows = await db
				.select({ dow: utc('dow'), hour: utc('hour'), count: sql<number>`count(*)::int` })
				.from(activityEvent)
				.where(eq(activityEvent.user, login.toLowerCase()))
				.groupBy(sql`1, 2`);

			return buildPunchCard(rows.map((row) => [row.dow, row.hour, row.count]));
		},
		RHYTHM_TTL
	);
}

const lifecycleKey = (login: string) => `activity:lifecycle:v5:${login.toLowerCase()}`;

// Whether lifecycle activity is cached, so the stats page can stream cold work
export const isLifecycleActivityReady = (login: string) => isCached(lifecycleKey(login));

// Merge stored events with commit contribution months, deduped per repo
export function mergeLifecycleMonths(
	events: RepoActivityMonths,
	commits: RepoActivityMonths
): RepoActivityMonths {
	const out: Record<string, Set<string>> = {};
	for (const source of [events, commits]) {
		for (const [repo, months] of Object.entries(source)) {
			const target = (out[repo.toLowerCase()] ??= new Set());
			for (const month of months) target.add(month);
		}
	}
	return Object.fromEntries(
		Object.entries(out).map(([repo, months]) => [repo, [...months].sort()])
	);
}

// Monthly repo activity from stored events and GitHub commit contributions
export function getLifecycleActivity(login: string): Promise<RepoActivityMonths> {
	return cached(
		lifecycleKey(login),
		async () => {
			await Promise.allSettled([syncActivity(login), backfillActivity(login)]);
			const contributions = await getUserContributions(login);
			const month = sql<string>`to_char(date_trunc('month', ${activityEvent.createdAt}), 'YYYY-MM-01')`;
			const rows = await db
				.select({ repo: activityEvent.repo, month })
				.from(activityEvent)
				.where(eq(activityEvent.user, login.toLowerCase()))
				.groupBy(activityEvent.repo, month)
				.orderBy(activityEvent.repo, month);
			const events: RepoActivityMonths = {};
			for (const row of rows) {
				const key = row.repo.toLowerCase();
				(events[key] ??= []).push(row.month);
			}
			return mergeLifecycleMonths(events, contributions.commitMonths);
		},
		RHYTHM_TTL
	);
}

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
		reactions: row.reactions as Reactions | null,
		actor: row.user
	};
}

type PageOptions = {
	cursor?: string | null;
	type?: string | null;
	q?: string | null;
	dir?: string | null;
	limit?: number;
	repo?: string | null;
	exclude?: string | null;
};

// Read one page from the store, with keyset paging, filters and time direction.
// Pass login for user-scoped feeds, or null with a repo for repo-wide feeds
export async function getActivityPage(
	login: string | null,
	options: PageOptions = {}
): Promise<ActivityPage> {
	const limit = Math.min(Math.max(options.limit ?? PAGE_SIZE, 1), 100);
	const ascending = options.dir === 'asc';
	const conditions: SQL[] = [];
	if (login) conditions.push(eq(activityEvent.user, login.toLowerCase()));

	// Match the stored repo case-insensitively, so the lower(repo) index can serve it
	if (options.repo)
		conditions.push(eq(sql`lower(${activityEvent.repo})`, options.repo.toLowerCase()));
	if (!conditions.length) return { events: [], nextCursor: null };
	if (options.type) conditions.push(eq(activityEvent.type, options.type));
	if (options.exclude) conditions.push(notInArray(activityEvent.type, options.exclude.split(',')));
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
		// A tampered cursor date would blow up the query serializer, treat it as no cursor
		if (!Number.isNaN(at.getTime())) {
			const after = ascending ? gt : lt;
			conditions.push(
				or(
					after(activityEvent.createdAt, at),
					and(eq(activityEvent.createdAt, at), after(activityEvent.id, cursor.id))
				)!
			);
		}
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
