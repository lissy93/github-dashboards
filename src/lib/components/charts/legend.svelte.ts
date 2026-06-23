import { SvelteSet } from 'svelte/reactivity';

export type LegendState = ReturnType<typeof legendState>;

// Shared hover + show/hide state for an interactive chart legend, one per chart
export function legendState() {
	const hidden = new SvelteSet<string>();
	let hovered = $state<string | null>(null);
	return {
		hidden,
		get hovered() {
			return hovered;
		},
		set hovered(value: string | null) {
			hovered = value;
		},
		// Click a series to drop it from the chart, or restore it when already hidden
		toggle(key: string) {
			if (hidden.has(key)) hidden.delete(key);
			else hidden.add(key);
		}
	};
}
