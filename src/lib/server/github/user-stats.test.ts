import { describe, expect, it } from 'vitest';
import { commitMonthsOf } from '$lib/server/github/user-stats';

const group = (
	first: string[],
	last: string[],
	pageInfo = { hasNextPage: false, hasPreviousPage: false }
) => ({
	repository: { nameWithOwner: 'Owner/Repo' },
	first: {
		nodes: first.map((occurredAt) => ({ occurredAt })),
		pageInfo: { hasNextPage: pageInfo.hasNextPage }
	},
	last: {
		nodes: last.map((occurredAt) => ({ occurredAt })),
		pageInfo: { hasPreviousPage: pageInfo.hasPreviousPage }
	}
});

describe('commitMonthsOf', () => {
	it('merges both ends of a contribution connection into distinct months', () => {
		const out = commitMonthsOf(
			[group(['2024-01-03T00:00:00Z', '2024-01-20T00:00:00Z'], ['2024-08-10T00:00:00Z'])],
			2024
		);
		expect(out['owner/repo']).toEqual(['2024-01-01', '2024-08-01']);
	});

	it('marks a truncated busy year active throughout rather than inventing gaps', () => {
		const out = commitMonthsOf(
			[
				group(['2024-01-03T00:00:00Z'], ['2024-12-10T00:00:00Z'], {
					hasNextPage: true,
					hasPreviousPage: true
				})
			],
			2024
		);
		expect(out['owner/repo']).toHaveLength(12);
		expect(out['owner/repo'][0]).toBe('2024-01-01');
		expect(out['owner/repo'].at(-1)).toBe('2024-12-01');
	});

	it('keeps overlapping first and last pages precise', () => {
		const out = commitMonthsOf(
			[
				group(
					['2024-01-03T00:00:00Z', '2024-06-01T00:00:00Z'],
					['2024-06-01T00:00:00Z', '2024-12-10T00:00:00Z'],
					{ hasNextPage: true, hasPreviousPage: true }
				)
			],
			2024
		);
		expect(out['owner/repo']).toEqual(['2024-01-01', '2024-06-01', '2024-12-01']);
	});
});
