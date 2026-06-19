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
