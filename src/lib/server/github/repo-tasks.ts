import { paginate } from '$lib/server/github/client';
import {
	toItem,
	mergeTaskLists,
	PR_FIELDS,
	ISSUE_FIELDS,
	type RawNode
} from '$lib/server/github/tasks';
import { cached, isCachedAll } from '$lib/server/cache';
import type { TaskList } from '$lib/types';

// PR nodes carry checks and diff stats, so keep the page small to dodge timeouts
const PER_PAGE = 50;
const MAX_PAGES = 4;
// Open work changes often, so refresh on visit but throttle rapid navigation
const TTL = 300;

const PR_QUERY = `
	query RepoPRs($owner: String!, $name: String!, $cursor: String, $states: [PullRequestState!]) {
		repository(owner: $owner, name: $name) {
			pullRequests(states: $states, first: ${PER_PAGE}, after: $cursor,
				orderBy: { field: UPDATED_AT, direction: DESC }) {
				totalCount
				pageInfo { hasNextPage endCursor }
				nodes { ${PR_FIELDS} }
			}
		}
	}
`;

const ISSUE_QUERY = `
	query RepoIssues($owner: String!, $name: String!, $cursor: String, $states: [IssueState!]) {
		repository(owner: $owner, name: $name) {
			issues(states: $states, first: ${PER_PAGE}, after: $cursor,
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

// Walk an issue or PR connection up to the page cap, tagging the kind so the shared
// mapper builds the right row. capped is set when GitHub has more than we hold
async function collect(
	owner: string,
	name: string,
	kind: 'pr' | 'issue',
	states: string[]
): Promise<TaskList> {
	const typename = kind === 'pr' ? 'PullRequest' : 'Issue';
	let total = 0;
	const { nodes } = await paginate<Omit<RawNode, '__typename'>, PrPage | IssuePage>(
		kind === 'pr' ? PR_QUERY : ISSUE_QUERY,
		{ owner, name, states },
		(data) => {
			const conn =
				kind === 'pr'
					? (data as PrPage).repository?.pullRequests
					: (data as IssuePage).repository?.issues;
			if (conn) total = conn.totalCount;
			return conn;
		},
		{ maxPages: MAX_PAGES }
	);
	const items = nodes.map((node) => toItem({ ...node, __typename: typename }));
	return { items, total, capped: items.length < total };
}

// Open work refreshes on visit, closed history is stable so it can live longer
const CLOSED_TTL = 3600;

const issuesKey = (owner: string, name: string) => `repo:issues:v1:${owner}/${name}`.toLowerCase();
const prsKey = (owner: string, name: string) => `repo:prs:v1:${owner}/${name}`.toLowerCase();
const closedIssuesKey = (owner: string, name: string) =>
	`repo:issues-closed:v1:${owner}/${name}`.toLowerCase();
const closedPrsKey = (owner: string, name: string) =>
	`repo:prs-closed:v1:${owner}/${name}`.toLowerCase();

// Currently open issues for a repo, newest activity first
export function getRepoIssues(owner: string, name: string): Promise<TaskList> {
	return cached(issuesKey(owner, name), () => collect(owner, name, 'issue', ['OPEN']), TTL);
}

// Currently open pull requests for a repo, with checks and diff stats per row
export function getRepoPullRequests(owner: string, name: string): Promise<TaskList> {
	return cached(prsKey(owner, name), () => collect(owner, name, 'pr', ['OPEN']), TTL);
}

// Recently closed issues, capped to the most recent, for the state-filtered detail page
function getRepoClosedIssues(owner: string, name: string): Promise<TaskList> {
	return cached(
		closedIssuesKey(owner, name),
		() => collect(owner, name, 'issue', ['CLOSED']),
		CLOSED_TTL
	);
}

// Recently closed and merged PRs, capped to the most recent
function getRepoClosedPullRequests(owner: string, name: string): Promise<TaskList> {
	return cached(
		closedPrsKey(owner, name),
		() => collect(owner, name, 'pr', ['CLOSED', 'MERGED']),
		CLOSED_TTL
	);
}

// Open plus recent closed issues, for the filterable detail page
export async function getRepoIssuesAll(owner: string, name: string): Promise<TaskList> {
	const [open, closed] = await Promise.all([
		getRepoIssues(owner, name),
		getRepoClosedIssues(owner, name)
	]);
	return mergeTaskLists(open, closed);
}

// Open plus recent closed and merged PRs, for the filterable detail page
export async function getRepoPullRequestsAll(owner: string, name: string): Promise<TaskList> {
	const [open, closed] = await Promise.all([
		getRepoPullRequests(owner, name),
		getRepoClosedPullRequests(owner, name)
	]);
	return mergeTaskLists(open, closed);
}

export const isRepoIssuesAllCached = (owner: string, name: string): Promise<boolean> =>
	isCachedAll(issuesKey(owner, name), closedIssuesKey(owner, name));

export const isRepoPullRequestsAllCached = (owner: string, name: string): Promise<boolean> =>
	isCachedAll(prsKey(owner, name), closedPrsKey(owner, name));

// Both open lists warm and expire independently, so the overview is only ready when each is
export const isRepoTasksCached = (owner: string, name: string): Promise<boolean> =>
	isCachedAll(issuesKey(owner, name), prsKey(owner, name));

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
