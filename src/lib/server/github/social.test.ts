import { describe, it, expect } from 'vitest';
import { rankFollowers } from '$lib/server/github/social';

// Minimal raw follower node, only the fields the ranking reads
const node = (login: string, followers: number) => ({
	login,
	name: login.toUpperCase(),
	avatarUrl: `https://avatars/${login}`,
	followers: { totalCount: followers }
});

describe('rankFollowers', () => {
	it('sorts by the follower count descending and flattens the node', () => {
		const out = rankFollowers([node('a', 10), node('b', 90), node('c', 50)]);
		expect(out.map((person) => person.login)).toEqual(['b', 'c', 'a']);
		expect(out[0]).toEqual({
			login: 'b',
			name: 'B',
			avatarUrl: 'https://avatars/b',
			followers: 90
		});
	});

	it('keeps only the top entries up to the limit', () => {
		const nodes = [node('a', 1), node('b', 2), node('c', 3), node('d', 4)];
		expect(rankFollowers(nodes, 2).map((person) => person.login)).toEqual(['d', 'c']);
	});

	it('handles an empty sample', () => {
		expect(rankFollowers([])).toEqual([]);
	});
});
