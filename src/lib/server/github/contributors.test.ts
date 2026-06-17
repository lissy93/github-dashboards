import { describe, it, expect } from 'vitest';
import { parseContributorCount } from '$lib/server/github/contributors';

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
