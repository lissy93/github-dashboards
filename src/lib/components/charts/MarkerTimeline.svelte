<script lang="ts">
	import { chartTip } from './chart-tip.svelte';
	import { timeTicks, nearestIndex, CHART_PAD } from './chart';
	import ChartTooltip from './ChartTooltip.svelte';
	import { chartBrush } from './brush.svelte';
	import ChartBrush from './ChartBrush.svelte';
	import type { ReleaseCadence } from '$lib/views/repo-stats';

	let { cadence, height = 5 }: { cadence: ReleaseCadence; height?: number } = $props();

	const PAD = { ...CHART_PAD, left: 14 };
	const STABLE = 'var(--chart-3)';
	const PRE = 'var(--muted-foreground)';
	const H = $derived(height * 16);

	let width = $state(0);
	let svg = $state<SVGSVGElement>();
	let hover = $state<number | null>(null);
	// Drag across the strip to zoom into a run of releases
	const resetKey = $derived.by(() => {
		const { markers } = cadence;
		return `${markers.length}|${markers[0]?.tag}|${markers.at(-1)?.tag}`;
	});
	const brush = chartBrush(
		(x) =>
			nearestIndex(
				geom.dots.map((dot) => dot.cx),
				x
			),
		{ resetKey: () => resetKey }
	);
	const view = $derived(brush.slice(cadence.markers));

	const geom = $derived.by(() => {
		const times = view.map((marker) => marker.time);
		const first = Math.min(...times);
		const span = Math.max(...times) - first || 1;
		const plotW = width - PAD.left - PAD.right;
		const axisY = PAD.top + (H - PAD.top - PAD.bottom) / 2;
		const dots = view.map((marker) => ({
			...marker,
			cx: PAD.left + ((marker.time - first) / span) * plotW,
			color: marker.prerelease ? PRE : STABLE
		}));
		return { dots, axisY, first, span, plotW };
	});

	// A label per calendar year, falling back to a few dates for short spans
	const xTicks = $derived.by(() => {
		if (!view.length) return [];
		const { first, span, plotW } = geom;
		return timeTicks(first, first + span).map((tick) => ({
			label: tick.label,
			x: PAD.left + ((tick.ms - first) / span) * plotW
		}));
	});

	const tip = chartTip();
	// Surface the release nearest the cursor with its gap since the previous one
	function move(event: PointerEvent) {
		brush.move(event);
		if (!svg || !geom.dots.length) return;
		const x = event.clientX - svg.getBoundingClientRect().left;
		const nearest = nearestIndex(
			geom.dots.map((dot) => dot.cx),
			x
		);
		hover = nearest;
		const dot = geom.dots[nearest];
		tip.show(event, {
			title: dot.tag,
			color: dot.color,
			rows: [
				{ label: 'Released', value: dot.date },
				...(dot.gapDays !== null ? [{ label: 'Since previous', value: `${dot.gapDays}d` }] : []),
				...(dot.prerelease ? [{ label: 'Pre-release', value: 'yes' }] : [])
			]
		});
	}
	function leave() {
		hover = null;
		tip.hide();
	}
</script>

<div class="relative w-full" style="height: {height}rem" bind:clientWidth={width}>
	{#if width > 0 && view.length}
		<svg
			bind:this={svg}
			class="touch-pan-y select-none"
			{width}
			height={H}
			role="img"
			aria-label="Release cadence over time"
			onpointermove={move}
			onpointerleave={leave}
			onpointerdown={brush.down}
			onpointerup={brush.up}
			onpointercancel={brush.cancel}
		>
			<line
				class="stroke-chart-grid"
				x1={PAD.left}
				x2={width - PAD.right}
				y1={geom.axisY}
				y2={geom.axisY}
			/>

			{#each xTicks as tick (tick.label)}
				<text
					class="fill-muted-foreground text-[0.65rem] tabular-nums"
					x={tick.x}
					y={H - 6}
					text-anchor="middle"
				>
					{tick.label}
				</text>
			{/each}

			{#each geom.dots as dot, index (dot.tag)}
				<circle
					cx={dot.cx}
					cy={geom.axisY}
					r={hover === index ? 5 : 3.5}
					fill={dot.color}
					fill-opacity={hover === index ? 1 : 0.85}
					stroke="var(--card)"
				/>
			{/each}
		</svg>
	{/if}
	<ChartBrush {brush} />
</div>

<ul class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
	<li class="flex items-center gap-1.5">
		<span class="size-2.5 shrink-0 rounded-sm" style="background-color: {STABLE}"></span>
		<span class="text-muted-foreground">Stable</span>
	</li>
	<li class="flex items-center gap-1.5">
		<span class="size-2.5 shrink-0 rounded-sm" style="background-color: {PRE}"></span>
		<span class="text-muted-foreground">Pre-release</span>
	</li>
</ul>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
