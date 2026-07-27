// Deterministic circle packing for bubble clouds. No physics or randomness, so the layout is
// stable across renders and easy to test. Circles are packed largest first, each new one set
// tangent to two already placed circles at the spot nearest the centre, giving a tight cluster
// with the biggest bubbles in the middle.

export type Circle = { x: number; y: number; r: number };

// Small slack so tangency rounding never reads as an overlap
const EPS = 1e-6;

// The two centres where a circle of radius r sits tangent to both a and b, or none if the
// pair is too far apart or one contains the other to admit a tangent circle
function tangentSpots(a: Circle, b: Circle, r: number): Array<{ x: number; y: number }> {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const d = Math.hypot(dx, dy);
	const ra = a.r + r;
	const rb = b.r + r;
	if (d < EPS || d > ra + rb || d < Math.abs(ra - rb)) return [];
	// Distance from a to the foot of the perpendicular between the two solutions
	const base = (ra * ra - rb * rb + d * d) / (2 * d);
	const height = Math.sqrt(Math.max(0, ra * ra - base * base));
	const mx = a.x + (dx * base) / d;
	const my = a.y + (dy * base) / d;
	const ox = (-dy * height) / d;
	const oy = (dx * height) / d;
	return [
		{ x: mx + ox, y: my + oy },
		{ x: mx - ox, y: my - oy }
	];
}

// Whether a circle at (x, y, r) clears every placed circle
function fits(placed: Circle[], x: number, y: number, r: number): boolean {
	return placed.every((c) => Math.hypot(c.x - x, c.y - y) >= c.r + r - EPS);
}

// Pack circles of the given radii into a roughly centred, non-overlapping cluster, returning a
// centre for each radius in input order. Radii are used as given, callers scale the result to fit
export function packCircles(radii: number[]): Circle[] {
	const placed: Circle[] = [];
	radii.forEach((r, index) => {
		if (index === 0) {
			placed.push({ x: 0, y: 0, r });
			return;
		}
		if (index === 1) {
			placed.push({ x: placed[0].r + r, y: 0, r });
			return;
		}
		// Try every placed pair, keep tangent spots that clear the rest, take the one nearest
		// the origin so the cluster stays compact and grows outward evenly
		let best: Circle | null = null;
		let bestDist = Infinity;
		for (let i = 0; i < placed.length; i++) {
			for (let j = i + 1; j < placed.length; j++) {
				for (const spot of tangentSpots(placed[i], placed[j], r)) {
					if (!fits(placed, spot.x, spot.y, r)) continue;
					const dist = Math.hypot(spot.x, spot.y);
					if (dist < bestDist) {
						best = { x: spot.x, y: spot.y, r };
						bestDist = dist;
					}
				}
			}
		}
		// No tangent spot clears (very lopsided sizes): drop it to the right of the cluster
		if (!best) {
			const edge = Math.max(0, ...placed.map((c) => c.x + c.r));
			best = { x: edge + r, y: 0, r };
		}
		placed.push(best);
	});
	return placed;
}
