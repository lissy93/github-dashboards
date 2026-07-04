import { paginate } from '$lib/server/github/client';
import { getUserOverview } from '$lib/server/github/user';
import { cached, isCached } from '$lib/server/cache';
import { logError } from '$lib/utils/errors';
import type {
	CheckState,
	Person,
	ReviewDecision,
	TaskBucket,
	TaskData,
	TaskItem,
	TaskList
} from '$lib/types';

// GitHub search returns at most 100 per page and 1000 results per query total
const PER_PAGE = 100;
const MAX_PAGES = 10;
// Open work changes often, so refresh on visit but throttle rapid navigation
const TTL = 300;

// Field lists shared with the repo task lists, so both build the same TaskItem rows
export const PR_FIELDS = `
	id number title url state isDraft createdAt updatedAt
	reviewDecision additions deletions changedFiles
	repository { nameWithOwner }
	author { login avatarUrl }
	assignees(first: 5) { nodes { login avatarUrl } }
	labels(first: 10) { nodes { name color } }
	comments { totalCount }
	commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
`;
export const ISSUE_FIELDS = `
	id number title url state createdAt updatedAt
	repository { nameWithOwner }
	author { login avatarUrl }
	assignees(first: 5) { nodes { login avatarUrl } }
	labels(first: 10) { nodes { name color } }
	comments { totalCount }
`;

const SEARCH = `
	query TaskSearch($q: String!, $cursor: String) {
		search(query: $q, type: ISSUE, first: ${PER_PAGE}, after: $cursor) {
			issueCount
			pageInfo { hasNextPage endCursor }
			nodes {
				__typename
				... on PullRequest { ${PR_FIELDS} }
				... on Issue { ${ISSUE_FIELDS} }
			}
		}
	}
`;

export type RawNode = {
	__typename: 'PullRequest' | 'Issue';
	id: string;
	number: number;
	title: string;
	url: string;
	state?: string;
	isDraft?: boolean;
	createdAt: string;
	updatedAt: string;
	reviewDecision?: string | null;
	additions?: number;
	deletions?: number;
	changedFiles?: number;
	repository: { nameWithOwner: string };
	author: Person | null;
	assignees: { nodes: Person[] };
	labels: { nodes: { name: string; color: string }[] };
	comments: { totalCount: number };
	commits?: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] };
};

// Collapse GitHub's rollup states into our three display buckets
function toChecks(node: RawNode): CheckState | null {
	const state = node.commits?.nodes[0]?.commit.statusCheckRollup?.state;
	if (!state) return null;
	if (state === 'SUCCESS') return 'success';
	if (state === 'FAILURE' || state === 'ERROR') return 'failure';
	return 'pending';
}

function toReview(decision?: string | null): ReviewDecision | null {
	if (decision === 'APPROVED') return 'approved';
	if (decision === 'CHANGES_REQUESTED') return 'changes_requested';
	if (decision === 'REVIEW_REQUIRED') return 'review_required';
	return null;
}

function toState(state?: string): TaskItem['state'] {
	if (state === 'MERGED') return 'merged';
	if (state === 'CLOSED') return 'closed';
	return 'open';
}

// Normalise a search node into the shared row, PR-only fields stay null on issues
export function toItem(node: RawNode): TaskItem {
	const isPr = node.__typename === 'PullRequest';
	return {
		id: node.id,
		kind: isPr ? 'pr' : 'issue',
		number: node.number,
		title: node.title,
		url: node.url,
		repo: node.repository.nameWithOwner,
		state: toState(node.state),
		draft: Boolean(node.isDraft),
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
		author: node.author && { login: node.author.login, avatarUrl: node.author.avatarUrl },
		assignees: node.assignees.nodes,
		labels: node.labels.nodes,
		comments: node.comments.totalCount,
		reviewDecision: isPr ? toReview(node.reviewDecision) : null,
		checks: isPr ? toChecks(node) : null,
		additions: isPr ? (node.additions ?? 0) : null,
		deletions: isPr ? (node.deletions ?? 0) : null,
		changedFiles: isPr ? (node.changedFiles ?? 0) : null
	};
}

// The search queries that make up one bucket. Authored lists make no sense for an
// org, and only PRs carry a review request
function sources(login: string, isOrg: boolean, kind: 'pr' | 'issue', mine: boolean): string[] {
	const base = `is:open ${kind === 'pr' ? 'is:pr' : 'is:issue'} sort:updated-desc`;
	if (mine) return isOrg ? [] : [`${base} author:${login}`];
	if (isOrg) return [`${base} user:${login}`];
	const list = [`${base} user:${login}`, `${base} assignee:${login}`];
	if (kind === 'pr') list.push(`${base} review-requested:${login}`);
	return list;
}

type SearchPage = {
	search: {
		issueCount: number;
		pageInfo: { hasNextPage: boolean; endCursor: string | null };
		nodes: RawNode[];
	};
};

// Page one search as far as GitHub allows. It serves at most 1000 results per query
// and reports no next page at that ceiling, so truncation is detected against the
// true issueCount rather than the page cursor
async function searchAll(q: string): Promise<{ nodes: RawNode[]; truncated: boolean }> {
	let issueCount = 0;
	const { nodes } = await paginate<RawNode, SearchPage>(
		SEARCH,
		{ q },
		({ search }) => {
			issueCount = search.issueCount;
			return search;
		},
		{ maxPages: MAX_PAGES }
	);
	return { nodes, truncated: nodes.length < issueCount };
}

// Run a bucket's sources in parallel, then merge by id so an item owned, assigned
// and review-requested still shows once. A failing source must not blank the rest
async function fetchBucket(
	login: string,
	isOrg: boolean,
	kind: 'pr' | 'issue',
	mine: boolean
): Promise<TaskList> {
	const queries = sources(login, isOrg, kind, mine);
	if (!queries.length) return { items: [], total: 0, capped: false };

	const settled = await Promise.allSettled(queries.map(searchAll));
	const byId = new Map<string, TaskItem>();
	let capped = false;
	for (const result of settled) {
		if (result.status === 'rejected') {
			logError('task-search', result.reason);
			continue;
		}
		if (result.value.truncated) capped = true;
		for (const node of result.value.nodes) byId.set(node.id, toItem(node));
	}

	const items = [...byId.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
	return { items, total: items.length, capped };
}

const BUCKETS: { bucket: TaskBucket; kind: 'pr' | 'issue'; mine: boolean }[] = [
	{ bucket: 'reviewPrs', kind: 'pr', mine: false },
	{ bucket: 'myPrs', kind: 'pr', mine: true },
	{ bucket: 'reviewIssues', kind: 'issue', mine: false },
	{ bucket: 'myIssues', kind: 'issue', mine: true }
];

const bucketKey = (bucket: TaskBucket, login: string) => `task:v1:${bucket}:${login.toLowerCase()}`;

// Load every bucket, each cached on its own so one slow search never holds the others
export async function getTaskData(login: string): Promise<TaskData> {
	const { profile } = await getUserOverview(login);
	const isOrg = profile.isOrg;

	const lists = await Promise.all(
		BUCKETS.map(({ bucket, kind, mine }) =>
			cached(
				bucketKey(bucket, profile.login),
				() => fetchBucket(profile.login, isOrg, kind, mine),
				TTL
			)
		)
	);

	const buckets = Object.fromEntries(
		BUCKETS.map(({ bucket }, index) => [bucket, lists[index]])
	) as Record<TaskBucket, TaskList>;

	return { login: profile.login, isOrg, buckets };
}

// Whether the buckets are already seeded, so the page renders inline vs streams
export const isTaskReady = (login: string) => isCached(bucketKey('reviewPrs', login));
