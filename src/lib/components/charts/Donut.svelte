<script lang="ts">
	import { seriesColor } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { compactNumber, formatNumber } from '$lib/format';
	import type { Slice, TipData } from '$lib/views/stats';

	let {
		data,
		centerLabel,
		valueLabel = 'Value'
	}: { data: Slice[]; centerLabel?: string; valueLabel?: string } = $props();

	const RADIUS = 42;
	const CIRC = 2 * Math.PI * RADIUS;
	const total = $derived(data.reduce((sum, slice) => sum + slice.value, 0));

	// Pair each slice with its colour, arc length and rotation offset
	const segments = $derived.by(() => {
		let cumulative = 0;
		return data.map((slice, index) => {
			const fraction = total > 0 ? slice.value / total : 0;
			const segment = {
				...slice,
				color: slice.color ?? seriesColor(index),
				dash: fraction * CIRC,
				offset: cumulative * CIRC,
				percent: Math.round(fraction * 100)
			};
			cumulative += fraction;
			return segment;
		});
	});

	const tip = chartTip();
	const tipFor = (segment: (typeof segments)[number]): TipData => ({
		title: segment.label,
		color: segment.color,
		rows: segment.rows ?? [
			{ label: valueLabel, value: formatNumber(segment.value) },
			{ label: 'Share', value: `${segment.percent}%` }
		]
	});
</script>

<div class="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
	<svg viewBox="0 0 100 100" class="size-32 shrink-0 -rotate-90" aria-hidden="true">
		{#each segments as segment (segment.label)}
			<circle
				cx="50"
				cy="50"
				r={RADIUS}
				fill="none"
				stroke={segment.color}
				stroke-width="14"
				stroke-dasharray="{segment.dash} {CIRC - segment.dash}"
				stroke-dashoffset={-segment.offset}
			/>
		{/each}
		{#if centerLabel}
			<text
				x="50"
				y="50"
				dy="0.35em"
				text-anchor="middle"
				class="fill-foreground rotate-90 text-[0.95rem] font-medium"
				style="transform-origin: center"
			>
				{centerLabel}
			</text>
		{/if}
	</svg>
	<ul class="grid w-full grow gap-1.5 text-xs">
		{#each segments as segment (segment.label)}
			<li
				class="flex items-center gap-2"
				onpointermove={(event) => tip.show(event, tipFor(segment))}
				onpointerleave={tip.hide}
			>
				<span class="size-2.5 shrink-0 rounded-sm" style="background-color: {segment.color}"></span>
				<span class="truncate">{segment.label}</span>
				<span class="text-muted-foreground ml-auto tabular-nums">
					{compactNumber(segment.value)}
				</span>
				<span class="text-muted-foreground w-9 text-right tabular-nums">{segment.percent}%</span>
			</li>
		{/each}
	</ul>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
