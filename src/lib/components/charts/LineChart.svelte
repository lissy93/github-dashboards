<script lang="ts">
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { compactNumber, formatNumber, formatDate } from '$lib/format';
	import type { Slice } from '$lib/views/stats';

	// data labels are ISO day strings, values plot on the y axis
	let {
		data,
		color = 'var(--chart-1)',
		height = 15,
		smooth = false
	}: { data: Slice[]; color?: string; height?: number; smooth?: boolean } = $props();

	const PAD = { top: 12, right: 14, bottom: 22, left: 44 };
	const Y_LINES = 4;
	const H = $derived(height * 16);

	let width = $state(0);
	let svg = $state<SVGSVGElement>();
	let hover = $state<number | null>(null);

	const geom = $derived.by(() => {
		const plotH = H - PAD.top - PAD.bottom;
		const times = data.map((point) => Date.parse(point.label));
		const values = data.map((point) => point.value);
		const [first, last] = [times[0], times.at(-1) ?? 0];
		const lo = Math.min(...values);
		const span = { time: last - first || 1, value: Math.max(...values) - lo || 1 };
		const xOf = (time: number) =>
			PAD.left + ((time - first) / span.time) * (width - PAD.left - PAD.right);
		const yOf = (value: number) => PAD.top + (1 - (value - lo) / span.value) * plotH;
		const points = data.map((point, index) => ({
			...point,
			cx: xOf(times[index]),
			cy: yOf(point.value)
		}));
		return { points, baseline: PAD.top + plotH, plotH, lo, span, xOf, first, last };
	});

	// Evenly spaced y values from the top of the range down to the bottom
	const yTicks = $derived(
		Array.from(
			{ length: Y_LINES + 1 },
			(_, index) => geom.lo + geom.span.value * (1 - index / Y_LINES)
		)
	);

	// A vertical line per calendar year, falling back to a few dates for short ranges
	const xTicks = $derived.by(() => {
		const points = geom.points;
		if (!points.length) return [];
		const startYear = new Date(geom.first).getUTCFullYear();
		const endYear = new Date(geom.last).getUTCFullYear();
		const years = [];
		for (let year = startYear + 1; year <= endYear; year++) {
			years.push({ label: String(year), x: geom.xOf(Date.UTC(year, 0, 1)), line: true });
		}
		if (years.length >= 2) return years;
		return [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map(
			(index) => ({
				label: formatDate(data[index].label),
				x: points[index].cx,
				line: false
			})
		);
	});

	const line = $derived(pathFrom(geom.points, smooth));
	const area = $derived(
		`${line} L${geom.points.at(-1)?.cx} ${geom.baseline} L${geom.points[0]?.cx} ${geom.baseline} Z`
	);

	// Straight segments, or a Catmull-Rom spline through every point for gentle smoothing
	function pathFrom(points: { cx: number; cy: number }[], curve: boolean): string {
		if (!points.length) return '';
		if (!curve || points.length < 3)
			return points.map((point, index) => `${index ? 'L' : 'M'}${point.cx} ${point.cy}`).join(' ');
		let path = `M${points[0].cx} ${points[0].cy}`;
		for (let index = 0; index < points.length - 1; index++) {
			const p0 = points[index - 1] ?? points[index];
			const p1 = points[index];
			const p2 = points[index + 1];
			const p3 = points[index + 2] ?? p2;
			const c1x = p1.cx + (p2.cx - p0.cx) / 6;
			const c1y = p1.cy + (p2.cy - p0.cy) / 6;
			const c2x = p2.cx - (p3.cx - p1.cx) / 6;
			const c2y = p2.cy - (p3.cy - p1.cy) / 6;
			path += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.cx} ${p2.cy}`;
		}
		return path;
	}

	const tip = chartTip();
	// Track the point nearest the cursor and surface its tooltip
	function move(event: PointerEvent) {
		if (!svg || !geom.points.length) return;
		const x = event.clientX - svg.getBoundingClientRect().left;
		const nearest = geom.points.reduce(
			(best, point, index) =>
				Math.abs(point.cx - x) < Math.abs(geom.points[best].cx - x) ? index : best,
			0
		);
		hover = nearest;
		const point = geom.points[nearest];
		tip.show(event, { title: formatDate(point.label), color, rows: point.rows ?? [] });
	}
	function leave() {
		hover = null;
		tip.hide();
	}
</script>

<div class="w-full" style="height: {height}rem" bind:clientWidth={width}>
	{#if width > 0}
		<svg
			bind:this={svg}
			{width}
			height={H}
			role="img"
			aria-label="Stars over time, {formatNumber(data[0].value)} to {formatNumber(
				data[data.length - 1].value
			)}"
			onpointermove={move}
			onpointerleave={leave}
		>
			{#each yTicks as value, index (index)}
				{@const y = PAD.top + (geom.plotH * index) / Y_LINES}
				<line class="stroke-chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} />
				<text
					class="fill-muted-foreground text-[0.65rem] tabular-nums"
					x={PAD.left - 6}
					{y}
					dy="0.32em"
					text-anchor="end"
				>
					{compactNumber(Math.round(value))}
				</text>
			{/each}

			{#each xTicks as tick (tick.label)}
				{#if tick.line}
					<line class="stroke-chart-grid" x1={tick.x} x2={tick.x} y1={PAD.top} y2={geom.baseline} />
				{/if}
				<text
					class="fill-muted-foreground text-[0.65rem] tabular-nums"
					x={tick.x}
					y={H - 6}
					text-anchor="middle"
				>
					{tick.label}
				</text>
			{/each}

			<path d={area} fill={color} opacity="0.12" />
			<path d={line} fill="none" stroke={color} stroke-width="1.5" />

			{#if hover !== null}
				{@const point = geom.points[hover]}
				<line
					class="stroke-chart-grid"
					x1={point.cx}
					x2={point.cx}
					y1={PAD.top}
					y2={geom.baseline}
				/>
				<circle
					cx={point.cx}
					cy={point.cy}
					r="3.5"
					fill={color}
					stroke="var(--card)"
					stroke-width="1.5"
				/>
			{/if}
		</svg>
	{/if}
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
