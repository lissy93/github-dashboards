import { describe, it, expect } from 'vitest';
import { packCircles } from '$lib/utils/pack';

// No two packed circles may overlap, allowing for float slack
function noOverlaps(circles: ReturnType<typeof packCircles>): boolean {
	for (let i = 0; i < circles.length; i++) {
		for (let j = i + 1; j < circles.length; j++) {
			const a = circles[i];
			const b = circles[j];
			if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 1e-4) return false;
		}
	}
	return true;
}

describe('packCircles', () => {
	it('returns one centre per radius, in order, with the radius preserved', () => {
		const radii = [3, 2, 2, 1, 1];
		const circles = packCircles(radii);
		expect(circles).toHaveLength(radii.length);
		expect(circles.map((circle) => circle.r)).toEqual(radii);
	});

	it('never overlaps circles, from a lone bubble up to a mixed cluster', () => {
		expect(noOverlaps(packCircles([5]))).toBe(true);
		expect(noOverlaps(packCircles([5, 5]))).toBe(true);
		expect(noOverlaps(packCircles([5, 3, 3, 2, 2, 1, 1, 1, 4, 2]))).toBe(true);
	});

	it('handles a lopsided set where small bubbles surround one large one', () => {
		const circles = packCircles([10, 1, 1, 1, 1, 1, 1]);
		expect(noOverlaps(circles)).toBe(true);
	});

	it('is deterministic for the same input', () => {
		const radii = [4, 3, 2, 2, 1];
		expect(packCircles(radii)).toEqual(packCircles(radii));
	});

	it('places the first bubble at the origin', () => {
		expect(packCircles([7])[0]).toEqual({ x: 0, y: 0, r: 7 });
	});
});
