import { describe, it, expect } from 'vitest';
import { parseContributorCount, summariseContributors } from '$lib/server/github/contributors';

// One unix week timestamp in seconds, weeks are 604800s apart
const WEEK = 604800;
const author = (login: string) => ({
	login,
	avatar_url: `https://x/${login}.png`,
	html_url: `https://github.com/${login}`
});

const link = (page: number) =>
	`<https://api.github.com/repositories/1/contributors?per_page=1&page=2>; rel="next", ` +
	`<https://api.github.com/repositories/1/contributors?per_page=1&page=${page}>; rel="last"`;

describe('parseContributorCount', () => {
	it('reads the count from the last page number', () => {
		expect(parseContributorCount(link(42), 1)).toBe(42);
	});

	it('falls back to the body length when there is no last link', () => {
		expect(parseContributorCount(null, 1)).toBe(1);
		expect(parseContributorCount(null, 0)).toBe(0);
	});

	it('ignores a next link with no last link', () => {
		const next = '<https://api.github.com/x?per_page=1&page=2>; rel="next"';
		expect(parseContributorCount(next, 1)).toBe(1);
	});
});

describe('summariseContributors', () => {
	it('sums lines, derives recency and ranks by commits', () => {
		const rows = summariseContributors([
			{
				total: 3,
				author: author('alice'),
				weeks: [
					{ w: 10 * WEEK, a: 5, d: 2, c: 1 },
					{ w: 11 * WEEK, a: 0, d: 0, c: 0 },
					{ w: 12 * WEEK, a: 10, d: 3, c: 2 }
				]
			},
			{
				total: 9,
				author: author('bob'),
				weeks: [{ w: 12 * WEEK, a: 100, d: 40, c: 9 }]
			}
		]);

		expect(rows.map((row) => row.login)).toEqual(['bob', 'alice']);
		const alice = rows[1];
		expect(alice.additions).toBe(15);
		expect(alice.deletions).toBe(5);
		// First and last commit ignore the empty middle week
		expect(alice.firstCommit).toBe(new Date(10 * WEEK * 1000).toISOString().slice(0, 10));
		expect(alice.lastCommit).toBe(new Date(12 * WEEK * 1000).toISOString().slice(0, 10));
		expect(alice.spark.length).toBeGreaterThan(0);
	});

	it('drops anonymous authors and zero-commit rows', () => {
		const rows = summariseContributors([
			{ total: 0, author: author('ghost'), weeks: [] },
			{ total: 4, author: null, weeks: [{ w: WEEK, a: 1, d: 1, c: 4 }] },
			{ total: 4, author: author('real'), weeks: [{ w: WEEK, a: 1, d: 1, c: 4 }] }
		]);
		expect(rows.map((row) => row.login)).toEqual(['real']);
	});
});
