import { describe, it, expect } from 'vitest';
import { mergeTrafficDays } from '$lib/server/github/traffic';

const day = (date: string, count: number, uniques: number) => ({
	timestamp: `${date}T00:00:00Z`,
	count,
	uniques
});

describe('mergeTrafficDays', () => {
	it('combines views and clones onto one row per day', () => {
		const rows = mergeTrafficDays(
			[day('2026-06-10', 50, 12), day('2026-06-11', 30, 8)],
			[day('2026-06-10', 5, 2)]
		);
		expect(rows).toEqual([
			{ day: '2026-06-10', views: 50, uniqueViews: 12, clones: 5, uniqueClones: 2 },
			{ day: '2026-06-11', views: 30, uniqueViews: 8, clones: 0, uniqueClones: 0 }
		]);
	});

	it('keeps clone-only days with zero views', () => {
		const rows = mergeTrafficDays([], [day('2026-06-10', 3, 1)]);
		expect(rows).toEqual([
			{ day: '2026-06-10', views: 0, uniqueViews: 0, clones: 3, uniqueClones: 1 }
		]);
	});

	it('returns nothing when there is no traffic', () => {
		expect(mergeTrafficDays([], [])).toEqual([]);
	});
});
