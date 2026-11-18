import { describe, it, expect, vi } from 'vitest';

type Paginate = (query: string, vars: Record<string, unknown>) => Promise<unknown>;
const { paginate } = vi.hoisted(() => ({
	paginate: vi.fn<Paginate>(async () => ({ nodes: [], cursor: null, complete: true }))
}));
vi.mock('$lib/server/github/client', () => ({
	paginate,
	PAGE_INFO: 'pageInfo { hasNextPage endCursor }'
}));

const { findChanges, foldChanges } = await import('$lib/server/github/repo-changes');

const hit = (repo: string, updatedAt: string) => ({
	updatedAt,
	repository: { nameWithOwner: repo }
});
const started = Date.parse('2026-11-18T22:00:00Z');

describe('foldChanges', () => {
	it("keeps each repo's latest change, keyed lowercase", () => {
		const { repos } = foldChanges(
			[
				hit('Lissy93/bug-bounties', '2026-11-18T14:14:49Z'),
				hit('lissy93/dashy', '2026-11-18T15:00:00Z'),
				hit('lissy93/bug-bounties', '2026-11-18T21:52:12Z')
			],
			true,
			started
		);
		expect(repos).toEqual({
			'lissy93/bug-bounties': '2026-11-18T21:52:12Z',
			'lissy93/dashy': '2026-11-18T15:00:00Z'
		});
	});

	it.each([
		['some', [hit('lissy93/dashy', '2026-11-18T21:59:00Z')]],
		['no', []]
	])('starts the next look a little before this one after %s hits', (_label, hits) => {
		const { checkedAt } = foldChanges(hits, true, started);
		expect(Date.parse(checkedAt)).toBeLessThan(started);
		expect(Date.parse(checkedAt)).toBeGreaterThan(started - 3600000);
	});

	it('resumes a capped walk from its last hit rather than skipping the unread rest', () => {
		const hits = [
			hit('lissy93/dashy', '2026-10-23T10:00:00Z'),
			hit('lissy93/web-check', '2026-10-24T08:00:00Z')
		];
		expect(foldChanges(hits, false, started).checkedAt).toBe('2026-10-24T08:00:00Z');
	});
});

describe('findChanges', () => {
	it('walks oldest first from the given time, which a capped walk relies on to resume', async () => {
		await findChanges('lissy93', '2026-11-17T18:19:44.438Z');
		const [, vars] = paginate.mock.calls[0];
		expect(vars.q).toBe('user:lissy93 updated:>=2026-11-17T18:19:44.438Z sort:updated-asc');
	});
});
