import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppError, toAppError } from '$lib/utils/errors';

const { graphql } = vi.hoisted(() => ({ graphql: vi.fn() }));
vi.mock('$lib/server/github/client', () => ({
	graphql,
	looksRestricted: (total: number, got: number) => total > 0 && got === 0,
	isRefusedList: (error: unknown) => ['forbidden', 'upstream'].includes(toAppError(error).code)
}));
vi.mock('$lib/server/auth/context', () => ({
	usingAppToken: () => true,
	withAppToken: (run: () => unknown) => run()
}));
vi.mock('$lib/server/cache', () => ({
	cached: (_key: string, fetcher: () => unknown) => fetcher(),
	isCached: () => false
}));

const { getRepoPeople } = await import('$lib/server/github/repo-people');

const audience = {
	repository: {
		stargazerCount: 26344,
		watchers: { totalCount: 81, nodes: [{ login: 'wendy', avatarUrl: 'w.png' }] },
		forks: {
			totalCount: 1921,
			nodes: [{ createdAt: '2026-01-01', owner: { login: 'fred', avatarUrl: 'f.png' } }]
		}
	}
};

// Answer the audience query, and hand the stargazer query whatever the test wants
const respond = (stars: () => unknown) =>
	graphql.mockImplementation((query: string) =>
		/RepoStargazers/.test(query) ? Promise.resolve(stars()) : Promise.resolve(audience)
	);

beforeEach(() => graphql.mockReset());

describe('repo audience', () => {
	it('gates only the stargazers when GitHub refuses the list', async () => {
		respond(() => {
			throw new AppError('forbidden', 'Resource not accessible by integration');
		});
		const people = await getRepoPeople('lissy93', 'dashy');
		expect(people.stargazers).toEqual({ total: 26344, people: [], unavailable: 'restricted' });
		expect(people.forks.people).toHaveLength(1);
		expect(people.watchers.people).toHaveLength(1);
	});

	it('reads an internal error as the same gate, since a viewer token fails that way', async () => {
		respond(() => {
			throw new AppError('upstream', 'Something went wrong while executing your query');
		});
		const people = await getRepoPeople('lissy93', 'dashy');
		expect(people.stargazers.unavailable).toBe('restricted');
		expect(people.forks.people).toHaveLength(1);
	});

	it('lets a rate limit fail, so a drained budget is never cached as a gate', async () => {
		respond(() => {
			throw new AppError('rate_limited', 'API rate limit exceeded');
		});
		await expect(getRepoPeople('lissy93', 'dashy')).rejects.toThrow('rate limit');
	});

	it('keeps the real stargazers when the list comes back', async () => {
		respond(() => ({
			repository: {
				stargazers: {
					totalCount: 26344,
					edges: [{ starredAt: '2026-02-02', node: { login: 'sam', avatarUrl: 's.png' } }]
				}
			}
		}));
		const people = await getRepoPeople('lissy93', 'dashy');
		expect(people.stargazers.people).toEqual([
			{ login: 'sam', avatarUrl: 's.png', at: '2026-02-02' }
		]);
		expect(people.stargazers.unavailable).toBeUndefined();
	});
});
