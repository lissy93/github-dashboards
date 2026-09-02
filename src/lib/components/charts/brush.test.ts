import { describe, expect, it, vi } from 'vitest';

const { chartBrush } = await import('$lib/components/charts/brush.svelte');

// One stub point every 10px, so pixel maths reads straight off the numbers below
const indexAt = (x: number) => Math.floor(x / 10);
const points = Array.from({ length: 12 }, (_, index) => index);

const plot = { getBoundingClientRect: () => ({ left: 0 }), setPointerCapture: () => {} };
const event = (x: number) =>
	({ clientX: x, pointerId: 1, currentTarget: plot }) as unknown as PointerEvent;

// Press, drag and release across the plot
function drag(brush: ReturnType<typeof chartBrush>, from: number, to: number) {
	brush.down(event(from));
	brush.move(event(to));
	brush.up();
}

describe('chart brush', () => {
	it('zooms to the dragged span and slices any parallel array', () => {
		const brush = chartBrush(indexAt);
		drag(brush, 20, 65);
		expect(brush.range).toEqual({ start: 2, end: 6 });
		expect(brush.slice(points)).toEqual([2, 3, 4, 5, 6]);
	});

	it('offsets a second drag against the full data, not the zoomed view', () => {
		const brush = chartBrush(indexAt);
		drag(brush, 20, 65);
		drag(brush, 0, 35);
		expect(brush.range).toEqual({ start: 2, end: 5 });
	});

	it('ignores a click or a nudge, so hovering never zooms', () => {
		const brush = chartBrush(indexAt);
		drag(brush, 20, 25);
		expect(brush.zoomed).toBe(false);
	});

	it('refuses a span too short to read as a time series', () => {
		const brush = chartBrush(indexAt);
		drag(brush, 20, 39);
		expect(brush.zoomed).toBe(false);
	});

	it('reports the band mid-drag and drops it once released', () => {
		const brush = chartBrush(indexAt);
		brush.down(event(60));
		brush.move(event(20));
		expect(brush.band).toEqual({ x: 20, width: 40 });
		brush.up();
		expect(brush.band).toBe(null);
	});

	it('drops the selection when the browser takes the gesture for a scroll', () => {
		const brush = chartBrush(indexAt);
		brush.down(event(20));
		brush.move(event(65));
		brush.cancel();
		expect(brush.zoomed).toBe(false);
	});

	it('drops the zoom when a different dataset is drawn, rather than carrying it over', () => {
		let subject = 'issues';
		const brush = chartBrush(indexAt, { resetKey: () => subject });
		drag(brush, 20, 65);
		expect(brush.zoomed).toBe(true);
		subject = 'prs';
		expect(brush.zoomed).toBe(false);
		expect(brush.slice(points)).toEqual(points);
	});

	it('tells the panel about every range change, so captions follow the zoom', () => {
		const onchange = vi.fn();
		const brush = chartBrush(indexAt, { onchange });
		drag(brush, 20, 65);
		brush.reset();
		expect(brush.slice(points)).toEqual(points);
		expect(onchange.mock.calls).toEqual([[{ start: 2, end: 6 }], [null]]);
	});
});
