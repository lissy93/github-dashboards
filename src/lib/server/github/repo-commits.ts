import { graphql } from '$lib/server/github/client';
import { cached } from '$lib/server/cache';
import type { CommitPage, CommitPr, CommitRef, GraphCommit, RepoCommitGraph } from '$lib/types';

const TTL = 900;
const PAGE = 100;

const COMMIT_FIELDS = `
	fragment commitFields on Commit {
		oid
		abbreviatedOid
		messageHeadline
		committedDate
		author { name user { login } }
		parents(first: 8) { nodes { oid } }
		associatedPullRequests(first: 2) {
			nodes { number state repository { nameWithOwner } headRepositoryOwner { login } }
		}
	}
`;

const PAGE_QUERY = `
	${COMMIT_FIELDS}
	query HistoryPage($owner: String!, $name: String!, $qualified: String!, $page: Int!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			ref(qualifiedName: $qualified) {
				target {
					... on Commit {
						history(first: $page, after: $cursor) {
							pageInfo { hasNextPage endCursor }
							nodes { ...commitFields }
						}
					}
				}
			}
		}
	}
`;

const REFS_QUERY = `
	query Refs($owner: String!, $name: String!) {
		repository(owner: $owner, name: $name) {
			defaultBranchRef { name }
			branches: refs(refPrefix: "refs/heads/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
				totalCount
				nodes { name target { oid } }
			}
			tags: refs(refPrefix: "refs/tags/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
				totalCount
				nodes { name target { oid ... on Tag { target { oid } } } }
			}
		}
	}
`;

type RawPr = {
	number: number;
	state: 'OPEN' | 'CLOSED' | 'MERGED';
	repository: { nameWithOwner: string };
	headRepositoryOwner: { login: string } | null;
};
type RawCommit = {
	oid: string;
	abbreviatedOid: string;
	messageHeadline: string;
	committedDate: string;
	author: { name: string | null; user: { login: string } | null } | null;
	parents: { nodes: { oid: string }[] };
	associatedPullRequests: { nodes: RawPr[] };
};
type PageRaw = {
	repository: {
		ref: {
			target: {
				history: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: RawCommit[] };
			} | null;
		} | null;
	} | null;
};
type BranchRef = { name: string; target: { oid: string } | null };
type TagRef = { name: string; target: { oid: string; target?: { oid: string } | null } | null };
type RefsRaw = {
	repository: {
		defaultBranchRef: { name: string } | null;
		branches: { totalCount: number; nodes: BranchRef[] };
		tags: { totalCount: number; nodes: TagRef[] };
	} | null;
};
type RepoRefs = {
	defaultBranch: string;
	branchCount: number;
	tagCount: number;
	branches: string[];
	byOid: Record<string, CommitRef[]>;
};

const graphKey = (owner: string, name: string) =>
	`repo:commit-graph:v4:${owner}/${name}`.toLowerCase();
const refsKey = (owner: string, name: string) =>
	`repo:commit-refs:v1:${owner}/${name}`.toLowerCase();

// The PR that introduced a commit, skipping PRs raised against some other repo (the
// first association can belong to upstream when viewing a fork, hence first: 2). A
// missing head owner means the fork was deleted, so that still counts as external
function toPr(nodes: RawPr[], owner: string, name: string): CommitPr | null {
	const repoPath = `${owner}/${name}`.toLowerCase();
	const pr = nodes.find((node) => node.repository.nameWithOwner.toLowerCase() === repoPath);
	if (!pr) return null;
	return {
		number: pr.number,
		state: pr.state.toLowerCase() as CommitPr['state'],
		external: pr.headRepositoryOwner?.login.toLowerCase() !== owner.toLowerCase()
	};
}

// Shape one raw commit, dropping parents back to bare oids for the DAG
function toCommit(raw: RawCommit, owner: string, name: string): GraphCommit {
	return {
		oid: raw.oid,
		short: raw.abbreviatedOid,
		message: raw.messageHeadline,
		date: raw.committedDate,
		author: raw.author?.name ?? null,
		login: raw.author?.user?.login ?? null,
		parents: raw.parents.nodes.map((parent) => parent.oid),
		refs: [],
		pr: toPr(raw.associatedPullRequests.nodes, owner, name)
	};
}

// Branch and tag labels keyed by the commit oid they point at. Annotated tags
// resolve through their inner target to the commit they actually tag
export function indexRefs(
	branches: BranchRef[],
	tags: TagRef[],
	defaultBranch: string
): Record<string, CommitRef[]> {
	const byOid: Record<string, CommitRef[]> = {};
	const add = (oid: string, ref: CommitRef) => (byOid[oid] = [...(byOid[oid] ?? []), ref]);
	for (const branch of branches)
		if (branch.target)
			add(branch.target.oid, {
				name: branch.name,
				type: 'branch',
				isDefault: branch.name === defaultBranch
			});
	for (const tag of tags) {
		const oid = tag.target?.target?.oid ?? tag.target?.oid;
		if (oid) add(oid, { name: tag.name, type: 'tag', isDefault: false });
	}
	return byOid;
}

// Branches, tags and the oid label map, cached so any history page can be labelled cheaply
function getRepoRefs(owner: string, name: string): Promise<RepoRefs> {
	return cached(
		refsKey(owner, name),
		async () => {
			const { repository } = await graphql<RefsRaw>(REFS_QUERY, { owner, name });
			const defaultBranch = repository?.defaultBranchRef?.name ?? '';
			const branchNodes = repository?.branches.nodes ?? [];
			const others = branchNodes
				.map((branch) => branch.name)
				.filter((branch) => branch !== defaultBranch);
			return {
				defaultBranch,
				branchCount: repository?.branches.totalCount ?? 0,
				tagCount: repository?.tags.totalCount ?? 0,
				branches: [defaultBranch, ...others].filter(Boolean),
				byOid: indexRefs(branchNodes, repository?.tags.nodes ?? [], defaultBranch)
			};
		},
		TTL
	);
}

// One page of a branch's history, newest first, with a cursor when more remain
async function fetchHistoryPage(
	owner: string,
	name: string,
	branch: string,
	cursor: string | null
): Promise<CommitPage> {
	const data = await graphql<PageRaw>(PAGE_QUERY, {
		owner,
		name,
		qualified: `refs/heads/${branch}`,
		page: PAGE,
		cursor
	});
	const history = data.repository?.ref?.target?.history;
	if (!history) return { commits: [], nextCursor: null };
	return {
		commits: history.nodes.map((node) => toCommit(node, owner, name)),
		nextCursor: history.pageInfo.hasNextPage ? history.pageInfo.endCursor : null
	};
}

// A labelled page of history for any branch, used by the load-more endpoint
export async function getRepoCommitPage(
	owner: string,
	name: string,
	branch?: string,
	cursor?: string | null
): Promise<CommitPage> {
	const refs = await getRepoRefs(owner, name);
	const page = await fetchHistoryPage(owner, name, branch || refs.defaultBranch, cursor ?? null);
	for (const commit of page.commits) commit.refs = refs.byOid[commit.oid] ?? [];
	return page;
}

// Initial history graph for the default branch: the first page plus the branch and tag
// context the picker and labels need. Further pages stream in via getRepoCommitPage
export function getRepoCommitGraph(owner: string, name: string): Promise<RepoCommitGraph> {
	return cached(
		graphKey(owner, name),
		async () => {
			const refs = await getRepoRefs(owner, name);
			const page = await fetchHistoryPage(owner, name, refs.defaultBranch, null);
			for (const commit of page.commits) commit.refs = refs.byOid[commit.oid] ?? [];
			return {
				defaultBranch: refs.defaultBranch,
				branches: refs.branches,
				branchCount: refs.branchCount,
				tagCount: refs.tagCount,
				commits: page.commits,
				nextCursor: page.nextCursor
			};
		},
		TTL
	);
}
