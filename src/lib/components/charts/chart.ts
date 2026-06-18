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
