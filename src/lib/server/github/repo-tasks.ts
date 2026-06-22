import { graphql } from '$lib/server/github/client';
import { toItem, type RawNode } from '$lib/server/github/tasks';
import { cached, isCached } from '$lib/server/cache';
import type { TaskItem, TaskList } from '$lib/types';

// PR nodes carry checks and diff stats, so keep the page small to dodge timeouts
const PER_PAGE = 50;
const MAX_PAGES = 4;
// Open work changes often, so refresh on visit but throttle rapid navigation
const TTL = 300;

const PR_FIELDS = `
	id number title url isDraft createdAt updatedAt
	reviewDecision additions deletions changedFiles
	repository { nameWithOwner }
	author { login avatarUrl }
	assignees(first: 5) { nodes { login avatarUrl } }
	labels(first: 10) { nodes { name color } }
	comments { totalCount }
	commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
`;

const ISSUE_FIELDS = `
	id number title url createdAt updatedAt
	repository { nameWithOwner }
	author { login avatarUrl }
	assignees(first: 5) { nodes { login avatarUrl } }
	labels(first: 10) { nodes { name color } }
	comments { totalCount }
`;

const PR_QUERY = `
	query RepoPRs($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			pullRequests(states: OPEN, first: ${PER_PAGE}, after: $cursor,
				orderBy: { field: UPDATED_AT, direction: DESC }) {
				totalCount
				pageInfo { hasNextPage endCursor }
				nodes { ${PR_FIELDS} }
			}
		}
	}
`;

const ISSUE_QUERY = `
	query RepoIssues($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			issues(states: OPEN, first: ${PER_PAGE}, after: $cursor,
				orderBy: { field: UPDATED_AT, direction: DESC }) {
				totalCount
				pageInfo { hasNextPage endCursor }
				nodes { ${ISSUE_FIELDS} }
			}
		}
	}
`;

type Conn = {
	totalCount: number;
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
	nodes: Omit<RawNode, '__typename'>[];
};
type PrPage = { repository: { pullRequests: Conn } | null };
type IssuePage = { repository: { issues: Conn } | null };

// Walk an OPEN issue or PR connection up to the page cap, tagging the kind so the
// shared mapper builds the right row. capped is set when GitHub has more than we hold
async function collect(owner: string, name: string, kind: 'pr' | 'issue'): Promise<TaskList> {
	const typename = kind === 'pr' ? 'PullRequest' : 'Issue';
	const items: TaskItem[] = [];
	let cursor: string | null = null;
	let total = 0;
	for (let page = 0; page < MAX_PAGES; page++) {
		let conn: Conn | null | undefined;
		if (kind === 'pr') {
			const data: PrPage = await graphql<PrPage>(PR_QUERY, { owner, name, cursor });
			conn = data.repository?.pullRequests;
		} else {
			const data: IssuePage = await graphql<IssuePage>(ISSUE_QUERY, { owner, name, cursor });
			conn = data.repository?.issues;
		}
		if (!conn) break;
		total = conn.totalCount;
		for (const node of conn.nodes) items.push(toItem({ ...node, __typename: typename }));
		if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
		cursor = conn.pageInfo.endCursor;
	}
	return { items, total, capped: items.length < total };
}

const issuesKey = (owner: string, name: string) => `repo:issues:${owner}/${name}`.toLowerCase();
const prsKey = (owner: string, name: string) => `repo:prs:${owner}/${name}`.toLowerCase();

export const isRepoTasksCached = (owner: string, name: string) => isCached(prsKey(owner, name));

// Currently open issues for a repo, newest activity first
export function getRepoIssues(owner: string, name: string): Promise<TaskList> {
	return cached(issuesKey(owner, name), () => collect(owner, name, 'issue'), TTL);
}

// Currently open pull requests for a repo, with checks and diff stats per row
export function getRepoPullRequests(owner: string, name: string): Promise<TaskList> {
	return cached(prsKey(owner, name), () => collect(owner, name, 'pr'), TTL);
}

// Both open lists together, for the combined repo tasks page
export async function getRepoTasks(
	owner: string,
	name: string
): Promise<{ issues: TaskList; prs: TaskList }> {
	const [issues, prs] = await Promise.all([
		getRepoIssues(owner, name),
		getRepoPullRequests(owner, name)
	]);
	return { issues, prs };
}
