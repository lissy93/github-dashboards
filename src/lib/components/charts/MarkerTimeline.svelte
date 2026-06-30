<script lang="ts">
	import { chartTip } from './chart-tip.svelte';
	import { yearMarks } from './chart';
	import ChartTooltip from './ChartTooltip.svelte';
	import { formatDate } from '$lib/format';
	import type { ReleaseCadence } from '$lib/views/repo-stats';

	let { cadence, height = 5 }: { cadence: ReleaseCadence; height?: number } = $props();

	const PAD = { top: 12, right: 14, bottom: 22, left: 14 };
	const STABLE = 'var(--chart-3)';
	const PRE = 'var(--muted-foreground)';
	const H = $derived(height * 16);

	let width = $state(0);
	let svg = $state<SVGSVGElement>();
	let hover = $state<number | null>(null);

	const geom = $derived.by(() => {
		const times = cadence.markers.map((marker) => marker.time);
		const first = Math.min(...times);
		const span = Math.max(...times) - first || 1;
		const plotW = width - PAD.left - PAD.right;
		const axisY = PAD.top + (H - PAD.top - PAD.bottom) / 2;
		const dots = cadence.markers.map((marker) => ({
			...marker,
			cx: PAD.left + ((marker.time - first) / span) * plotW,
			color: marker.prerelease ? PRE : STABLE
		}));
		return { dots, axisY, first, span, plotW };
	});

	// A label per calendar year, falling back to first and last for short spans
	const xTicks = $derived.by(() => {
		if (!cadence.markers.length) return [];
		const { first, span, plotW } = geom;
		const last = first + span;
		const years = yearMarks(first, last).map((mark) => ({
			label: String(mark.year),
			x: PAD.left + ((mark.ms - first) / span) * plotW
		}));
		if (years.length) return years;
		return [...new Set([first, last])].map((time) => ({
			label: formatDate(new Date(time).toISOString()),
			x: PAD.left + ((time - first) / span) * plotW
		}));
	});

	const tip = chartTip();
	// Surface the release nearest the cursor with its gap since the previous one
	function move(event: PointerEvent) {
		if (!svg || !geom.dots.length) return;
		const x = event.clientX - svg.getBoundingClientRect().left;
		const nearest = geom.dots.reduce(
			(best, dot, index) =>
				Math.abs(dot.cx - x) < Math.abs(geom.dots[best].cx - x) ? index : best,
			0
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

<div class="w-full" style="height: {height}rem" bind:clientWidth={width}>
	{#if width > 0 && cadence.markers.length}
		<svg
			bind:this={svg}
			{width}
			height={H}
			role="img"
			aria-label="Release cadence over time"
			onpointermove={move}
			onpointerleave={leave}
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
