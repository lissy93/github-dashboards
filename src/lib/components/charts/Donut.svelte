<script lang="ts">
	import { seriesColor } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { legendState } from './legend.svelte';
	import { compactNumber, formatNumber } from '$lib/format';
	import type { Slice, TipData } from '$lib/views/stats';

	let {
		data,
		legend: legendSlices,
		centerLabel,
		valueLabel = 'Value'
	}: { data: Slice[]; legend?: Slice[]; centerLabel?: string; valueLabel?: string } = $props();

	const RADIUS = 42;
	const CIRC = 2 * Math.PI * RADIUS;
	const legend = legendState();

	// Pair each slice with its colour, arc length and rotation offset
	function toSegments(slices: Slice[]) {
		const total = slices.reduce((sum, slice) => sum + slice.value, 0);
		let cumulative = 0;
		return slices.map((slice, index) => {
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
	}

	// The ring rescales to the slices left on, while the legend keeps the full list to toggle
	const visible = $derived(data.filter((slice) => !legend.hidden.has(slice.label)));
	const segments = $derived(toSegments(visible));
	const legendSegments = $derived(toSegments(legendSlices ?? data));

	const tip = chartTip();
	const tipFor = (segment: (typeof segments)[number]): TipData => ({
		title: segment.label,
		color: segment.color,
		rows: segment.rows ?? [
			{ label: valueLabel, value: formatNumber(segment.value) },
			{ label: 'Share', value: `${segment.percent}%` }
		]
	});
	function show(event: PointerEvent, segment: (typeof segments)[number]) {
		legend.hovered = segment.label;
		tip.show(event, tipFor(segment));
	}
	function hide() {
		legend.hovered = null;
		tip.hide();
	}
</script>

<div class="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
	<svg viewBox="0 0 100 100" class="size-32 shrink-0 -rotate-90" role="img" aria-label={valueLabel}>
		{#each segments as segment (segment.label)}
			{@const lift = legend.hovered === segment.label}
			{@const dim = legend.hovered !== null && !lift}
			<circle
				class="transition-[stroke-width,opacity] duration-150"
				cx="50"
				cy="50"
				r={RADIUS}
				fill="none"
				stroke={segment.color}
				stroke-width={lift ? 17 : 14}
				stroke-dasharray="{segment.dash} {CIRC - segment.dash}"
				stroke-dashoffset={-segment.offset}
				opacity={dim ? 0.4 : 1}
				role="img"
				aria-label="{segment.label}: {formatNumber(segment.value)}"
				onpointermove={(event) => show(event, segment)}
				onpointerleave={hide}
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
		{#each legendSegments as segment (segment.label)}
			{@const off = legend.hidden.has(segment.label)}
			<li>
				<button
					type="button"
					class="flex w-full items-center gap-2 rounded-sm transition-opacity"
					class:opacity-40={off}
					aria-pressed={!off}
					onpointermove={(event) => show(event, segment)}
					onpointerleave={hide}
					onclick={() => legend.toggle(segment.label)}
				>
					<span class="size-2.5 shrink-0 rounded-sm" style="background-color: {segment.color}"
					></span>
					<span class="truncate" class:line-through={off}>{segment.label}</span>
					<span class="text-muted-foreground ml-auto tabular-nums">
						{compactNumber(segment.value)}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
