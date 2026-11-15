import { beforeEach, describe, it, expect, vi } from 'vitest';

const { graphql, readCached, writeCached } = vi.hoisted(() => ({
	graphql: vi.fn(),
	readCached: vi.fn(),
	writeCached: vi.fn<(key: string, value: unknown) => Promise<void>>(async () => {})
}));
vi.mock('$lib/server/github/client', () => ({ graphql, rest: vi.fn(), batchedGraphql: vi.fn() }));
vi.mock('$lib/server/github/stars', () => ({ snapshotStars: async () => {} }));
vi.mock('$lib/server/cache', () => ({
	cached: (_key: string, fetcher: () => unknown) => fetcher(),
	readCached,
	writeCached
}));

const { getUserOverview } = await import('$lib/server/github/user');

type Node = { nameWithOwner: string; stargazerCount: number };

const repo = (name: string, stars: number) => ({
	name,
	nameWithOwner: `org/${name}`,
	description: null,
	url: '',
	stargazerCount: stars,
	forkCount: 0,
	diskUsage: 0,
	isPrivate: false,
	isArchived: false,
	isFork: false,
	createdAt: '',
	updatedAt: '',
	pushedAt: '',
	owner: { login: 'org' },
	primaryLanguage: null,
	watchers: { totalCount: 0 },
	openIssues: { totalCount: 0 },
	openPRs: { totalCount: 0 },
	licenseInfo: null,
	repositoryTopics: { nodes: [] }
});

const owner = (login: string, nodes: Node[], total: number) => ({
	__typename: 'Organization',
	login,
	avatarUrl: '',
	name: null,
	location: null,
	websiteUrl: null,
	twitterUsername: null,
	createdAt: '',
	ownedRepos: {
		totalCount: total,
		nodes,
		pageInfo: { hasNextPage: total > nodes.length, endCursor: 'page-1' }
	}
});

// A stale stored list, so the next read kicks off a background sync
function storeStale(login: string, nodes: Node[]) {
	readCached.mockResolvedValueOnce({
		fetchedAt: new Date(0),
		value: {
			owner: owner(login, nodes, nodes.length),
			owned: { nodes, cursor: 'page-1', complete: true, total: nodes.length },
			contributed: { nodes: [], cursor: null, complete: true, total: 0 }
		}
	});
}

// GitHub's current first page, then the second page or a failure
function serve(login: string, first: Node[], total: number, rest: Node[] | Error) {
	graphql.mockImplementation(async (query: string) => {
		if (query.includes('query Overview')) return { repositoryOwner: owner(login, first, total) };
		if (!query.includes('query OwnedPage')) return { user: null };
		if (rest instanceof Error) throw rest;
		return {
			repositoryOwner: { repos: { nodes: rest, pageInfo: { hasNextPage: false, endCursor: null } } }
		};
	});
}

async function syncedRepos(login: string): Promise<string[]> {
	await getUserOverview(login);
	await vi.waitFor(() => expect(writeCached).toHaveBeenCalled());
	const state = writeCached.mock.calls[0][1] as { owned: { nodes: Node[] } };
	return state.owned.nodes.map((node) => `${node.nameWithOwner}:${node.stargazerCount}`);
}

describe('owned repo sync', () => {
	beforeEach(() => {
		graphql.mockReset();
		writeCached.mockClear();
	});

	it('rereads from the top after a rename, dropping the old name', async () => {
		storeStale('renamed', [repo('big', 50), repo('old-name', 11), repo('small', 1)]);
		serve('renamed', [repo('big', 50), repo('new-name', 11)], 3, [repo('small', 2)]);
		expect(await syncedRepos('renamed')).toEqual(['org/big:50', 'org/new-name:11', 'org/small:2']);
	});

	it('rereads from the top after a deletion, dropping the deleted repo', async () => {
		storeStale('deleted', [repo('big', 50), repo('gone', 3), repo('small', 1)]);
		serve('deleted', [repo('big', 50)], 2, [repo('small', 1)]);
		expect(await syncedRepos('deleted')).toEqual(['org/big:50', 'org/small:1']);
	});

	it('leaves an unchanged list alone, fetching no further pages', async () => {
		storeStale('steady', [repo('big', 50), repo('mid', 5), repo('small', 1)]);
		serve('steady', [repo('big', 51), repo('mid', 5)], 3, new Error('unexpected page'));
		expect(await syncedRepos('steady')).toEqual(['org/big:51', 'org/mid:5', 'org/small:1']);
		expect(graphql.mock.calls.some(([query]) => query.includes('query OwnedPage'))).toBe(false);
	});

	it('keeps the stored repos when a later page fails', async () => {
		storeStale('flaky', [repo('big', 50), repo('mid', 5), repo('small', 1)]);
		serve('flaky', [repo('big', 51), repo('new', 7)], 4, new Error('502'));
		expect(await syncedRepos('flaky')).toEqual([
			'org/big:51',
			'org/new:7',
			'org/mid:5',
			'org/small:1'
		]);
	});
});
