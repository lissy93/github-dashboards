// Categorical series colours, cycled for charts without their own colours
export const CHART_SERIES = [
	'var(--chart-1)',
	'var(--chart-2)',
	'var(--chart-3)',
	'var(--chart-4)',
	'var(--chart-5)'
];

// Pick a series colour by index, wrapping when there are more slices than tokens
export const seriesColor = (index: number) => CHART_SERIES[index % CHART_SERIES.length];

// Wider categorical palette for stacked series: the base tokens, then paler mixes,
// so up to ten bands stay distinct without leaving the oklch token system
export const STACK_SERIES = [
	...CHART_SERIES,
	...CHART_SERIES.map((token) => `color-mix(in oklch, ${token} 50%, var(--card))`)
];

export const stackColor = (index: number) => STACK_SERIES[index % STACK_SERIES.length];

// Five-step intensity ramp for the contribution heatmap, level 0 is the empty cell
export const HEATMAP_LEVELS = [
	'var(--muted)',
	'color-mix(in oklch, var(--chart-2) 28%, var(--muted))',
	'color-mix(in oklch, var(--chart-2) 52%, var(--muted))',
	'color-mix(in oklch, var(--chart-2) 76%, var(--muted))',
	'var(--chart-2)'
];

// Path through points: straight segments, or a Catmull-Rom spline for gentle,
// recharts "natural"-style smoothing that still passes through every point
export function splinePath(points: { x: number; y: number }[], smooth = false): string {
	if (!points.length) return '';
	if (!smooth || points.length < 3)
		return points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
	let path = `M${points[0].x} ${points[0].y}`;
	for (let index = 0; index < points.length - 1; index++) {
		const p0 = points[index - 1] ?? points[index];
		const p1 = points[index];
		const p2 = points[index + 1];
		const p3 = points[index + 2] ?? p2;
		const c1x = p1.x + (p2.x - p0.x) / 6;
		const c1y = p1.y + (p2.y - p0.y) / 6;
		const c2x = p2.x - (p3.x - p1.x) / 6;
		const c2y = p2.y - (p3.y - p1.y) / 6;
		path += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
	}
	return path;
}

// Round an axis maximum up to a clean step so bar heights read nicely
export function niceMax(value: number): number {
	if (value <= 0) return 1;
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const steps = [1, 2, 2.5, 5, 10];
	for (const step of steps) {
		const candidate = step * magnitude;
		if (candidate >= value) return candidate;
	}
	return 10 * magnitude;
}

// A clean gridline step sized for roughly `ticks` lines, so the axis top sits
// just above the data instead of jumping to the next coarse round number
export function niceStep(max: number, ticks: number): number {
	if (max <= 0) return 1;
	const rough = max / ticks;
	const magnitude = 10 ** Math.floor(Math.log10(rough));
	const norm = rough / magnitude;
	const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
	return step * magnitude;
}
