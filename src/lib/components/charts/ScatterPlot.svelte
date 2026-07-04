<script lang="ts">
	import { seriesColor, niceMax, niceStep, timeTicks, CHART_PAD } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import Gridlines from './Gridlines.svelte';
	import { compactNumber } from '$lib/utils/format';
	import type { ScatterPoint } from '$lib/types/charts';

	// time axes plot a date span, numeric axes plot zero to a nice max
	let {
		data,
		height = 15,
		xTime = false,
		yTime = false,
		xFormat = compactNumber,
		yFormat = compactNumber
	}: {
		data: ScatterPoint[];
		height?: number;
		xTime?: boolean;
		yTime?: boolean;
		xFormat?: (value: number) => string;
		yFormat?: (value: number) => string;
	} = $props();

	const PAD = { ...CHART_PAD, left: 48 };
	const LINES = 4;
	const R = { min: 2.5, max: 9 };
	const H = $derived(height * 16);

	let width = $state(0);
	let svg = $state<SVGSVGElement>();
	let hover = $state<number | null>(null);

	type Tick = { frac: number; label: string };
	type Axis = { norm: (value: number) => number; ticks: Tick[] };

	// Map an axis to a 0..1 position fn and its gridline ticks, by date or by value
	function buildAxis(values: number[], time: boolean, format: (value: number) => string): Axis {
		if (time) {
			const min = Math.min(...values);
			const max = Math.max(...values);
			const span = max - min || 1;
			const norm = (value: number) => (value - min) / span;
			const ticks = timeTicks(min, max).map((tick) => ({ frac: norm(tick.ms), label: tick.label }));
			return { norm, ticks };
		}
		const peak = Math.max(0, ...values);
		const step = niceStep(niceMax(peak), LINES);
		const top = Math.max(step, Math.ceil(peak / step) * step);
		const ticks: Tick[] = [];
		for (let value = 0; value <= top + step / 2; value += step) {
			ticks.push({ frac: value / top, label: format(value) });
		}
		return { norm: (value) => value / top, ticks };
	}

	const geom = $derived.by(() => {
		const plotW = width - PAD.left - PAD.right;
		const plotH = H - PAD.top - PAD.bottom;
		const baseline = PAD.top + plotH;
		const xs = buildAxis(
			data.map((point) => point.x),
			xTime,
			xFormat
		);
		const ys = buildAxis(
			data.map((point) => point.y),
			yTime,
			yFormat
		);
		const maxR = Math.max(1, ...data.map((point) => point.r));
		const rOf = (value: number) => R.min + Math.sqrt(value / maxR) * (R.max - R.min);
		const points = data.map((point) => ({
			...point,
			cx: PAD.left + xs.norm(point.x) * plotW,
			cy: baseline - ys.norm(point.y) * plotH,
			rad: rOf(point.r)
		}));
		const yTicks = ys.ticks.map((tick) => ({
			label: tick.label,
			y: baseline - tick.frac * plotH
		}));
		return { points, xs, yTicks, baseline, plotW };
	});

	const tip = chartTip();
	// Track the dot nearest the cursor by plain 2D distance and surface its tooltip
	function move(event: PointerEvent) {
		if (!svg || !geom.points.length) return;
		const rect = svg.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const nearest = geom.points.reduce((best, point, index) => {
			const here = (point.cx - x) ** 2 + (point.cy - y) ** 2;
			const winner = (geom.points[best].cx - x) ** 2 + (geom.points[best].cy - y) ** 2;
			return here < winner ? index : best;
		}, 0);
		hover = nearest;
		const point = geom.points[nearest];
		tip.show(event, {
			title: point.label,
			color: point.color ?? seriesColor(nearest),
			rows: point.rows ?? []
		});
	}
	function leave() {
		hover = null;
		tip.hide();
	}
</script>

<div class="w-full" style="height: {height}rem" bind:clientWidth={width}>
	{#if width > 0 && data.length}
		<svg
			bind:this={svg}
			{width}
			height={H}
			role="img"
			aria-label="Repositories plotted on two metrics"
			onpointermove={move}
			onpointerleave={leave}
		>
			<Gridlines ticks={geom.yTicks} left={PAD.left} right={width - PAD.right} />

			{#each geom.xs.ticks as tick (tick.label)}
				{@const x = PAD.left + tick.frac * geom.plotW}
				<line class="stroke-chart-grid" x1={x} x2={x} y1={PAD.top} y2={geom.baseline} />
				<text
					class="fill-muted-foreground text-[0.65rem] tabular-nums"
					{x}
					y={H - 6}
					text-anchor="middle"
				>
					{tick.label}
				</text>
			{/each}

			{#each geom.points as point, index (point.label)}
				<circle
					cx={point.cx}
					cy={point.cy}
					r={point.rad}
					fill={point.color ?? seriesColor(index)}
					fill-opacity={hover === index ? 0.95 : 0.7}
					stroke="var(--card)"
					stroke-width="1"
				/>
			{/each}
		</svg>
	{/if}
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
