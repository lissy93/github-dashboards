import type { TipData } from '$lib/views/stats';

// Shared cursor-following tooltip state for a chart, one instance per chart
export function chartTip() {
	let data = $state<TipData | null>(null);
	let x = $state(0);
	let y = $state(0);
	return {
		get data() {
			return data;
		},
		get x() {
			return x;
		},
		get y() {
			return y;
		},
		show(event: { clientX: number; clientY: number }, next: TipData) {
			data = next;
			x = event.clientX;
			y = event.clientY;
		},
		hide() {
			data = null;
		}
	};
}
