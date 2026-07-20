import { describe, it, expect } from 'vitest';
import { pickBaselines, preferTotals } from '$lib/server/github/stars';

const rows = [
	{ day: '2026-06-16', stars: 100 },
	{ day: '2026-06-09', stars: 90 },
	{ day: '2026-06-01', stars: 80 }
];

describe('pickBaselines', () => {
	it('matches a snapshot that sits close to the window cutoff', () => {
		const out = pickBaselines(rows, '2026-06-16');
		// 7 days ago is 06-09, the matching snapshot exists exactly
		expect(out[7]).toBe(90);
	});

	it('omits a window when the nearest snapshot is too far from its cutoff', () => {
		const out = pickBaselines(rows, '2026-06-16');
		// 1 day ago is 06-15 but the nearest snapshot (06-09) is 6 days too old
		expect(out[1]).toBeNull();
		// 30 and 90 days ago predate the oldest snapshot
		expect(out[30]).toBeNull();
		expect(out[90]).toBeNull();
	});

	it('accepts a snapshot within the tolerance of a longer window', () => {
		// 30 day cutoff is 05-17, snapshot 05-12 is 5 days older, within tolerance ceil(30*0.25)=8
		const out = pickBaselines([{ day: '2026-05-12', stars: 70 }], '2026-06-16');
		expect(out[30]).toBe(70);
	});

	it('returns null for every window with no history', () => {
		const out = pickBaselines([], '2026-06-16');
		expect(out).toEqual({ 1: null, 7: null, 30: null, 90: null });
	});
});

describe('preferTotals', () => {
	it('lets a genuine total beat a curve point on the same day, in either order', () => {
		const day = { repo: 'a/x', day: '2026-06-16' };
		expect(
			preferTotals([
				{ ...day, stars: 90, source: 'curve' },
				{ ...day, stars: 100, source: 'total' }
			])
		).toEqual([{ ...day, stars: 100, source: 'total' }]);
		expect(
			preferTotals([
				{ ...day, stars: 100, source: 'total' },
				{ ...day, stars: 90, source: 'curve' }
			])
		).toEqual([{ ...day, stars: 100, source: 'total' }]);
	});

	it('keeps rows for different repos or days separate', () => {
		const rows = [
			{ repo: 'a/x', day: '2026-06-16', stars: 10, source: 'curve' },
			{ repo: 'a/y', day: '2026-06-16', stars: 20, source: 'curve' },
			{ repo: 'a/x', day: '2026-06-17', stars: 11, source: 'curve' }
		];
		expect(preferTotals(rows)).toEqual(rows);
	});
});
