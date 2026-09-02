export type ChartRange = { start: number; end: number };

// Ignore a drag under this many px, so a click or a tooltip nudge never zooms
const MIN_DRAG = 8;
// Never zoom below this many points, the axis stops reading as a time series
const MIN_POINTS = 3;

// Drag across a time chart to zoom into a span of it, indices run against the full data
export function chartBrush(
	indexAt: (x: number) => number,
	options: {
		// Indices only mean anything against the data they were dragged on
		resetKey?: () => string;
		onchange?: (range: ChartRange | null) => void;
	} = {}
) {
	let held = $state<{ key: string; range: ChartRange } | null>(null);
	let from = $state<number | null>(null);
	let to = $state(0);

	const key = () => options.resetKey?.() ?? '';
	const range = () => (held?.key === key() ? held.range : null);

	const at = (event: PointerEvent) =>
		event.clientX - (event.currentTarget as Element).getBoundingClientRect().left;

	// Pixel band under the cursor, once the drag is wide enough to count as one
	const band = () => {
		if (from === null || Math.abs(to - from) < MIN_DRAG) return null;
		return { x: Math.min(from, to), width: Math.abs(to - from) };
	};

	function set(next: ChartRange | null) {
		held = next ? { key: key(), range: next } : null;
		options.onchange?.(next);
	}

	return {
		get range() {
			return range();
		},
		get zoomed() {
			return range() !== null;
		},
		get band() {
			return band();
		},
		// Cut any array running parallel to the chart's points down to the zoomed span
		slice<T>(items: T[]): T[] {
			const span = range();
			return span ? items.slice(span.start, span.end + 1) : items;
		},
		reset: () => set(null),
		down(event: PointerEvent) {
			from = at(event);
			to = from;
			(event.currentTarget as Element).setPointerCapture(event.pointerId);
		},
		move(event: PointerEvent) {
			if (from !== null) to = at(event);
		},
		up() {
			if (from === null) return;
			const dragged = band() !== null;
			const first = indexAt(Math.min(from, to));
			const last = indexAt(Math.max(from, to));
			from = null;
			if (!dragged || last - first + 1 < MIN_POINTS) return;
			// indices come from the current view, so offset them back to absolute
			const base = range()?.start ?? 0;
			set({ start: base + first, end: base + last });
		},
		cancel() {
			from = null;
		}
	};
}
