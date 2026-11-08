<script lang="ts">
	import { seriesColor } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { compactNumber, formatNumber } from '$lib/utils/format';
	import type { Slice, TipData } from '$lib/types/charts';

	// centerValue is the headline shown inside the arc, data stacks across the half ring.
	// compact sits the legend beside the gauge (wrapping below when narrow) to save height
	let {
		data,
		centerValue,
		centerLabel,
		valueLabel = 'Value',
		compact = false
	}: {
		data: Slice[];
		centerValue: string;
		centerLabel: string;
		valueLabel?: string;
		compact?: boolean;
	} = $props();

	const CX = 50;
	const CY = 50;
	const R = 40;
	const STROKE = 11;
	const total = $derived(data.reduce((sum, slice) => sum + slice.value, 0));

	// A point on the half ring, angle 180 at the left sweeping to 0 at the right
	function polar(angle: number): [number, number] {
		const radians = (angle * Math.PI) / 180;
		return [CX + R * Math.cos(radians), CY - R * Math.sin(radians)];
	}

	// Arc over the top between two cumulative fractions of the half ring
	function arc(from: number, to: number): string {
		const [x0, y0] = polar(180 - 180 * from);
		const [x1, y1] = polar(180 - 180 * to);
		return `M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}`;
	}

	const track = arc(0, 1);

	// Stack each non-empty slice along the ring, in order, from the left
	const segments = $derived.by(() => {
		let cumulative = 0;
		return data
			.filter((slice) => slice.value > 0)
			.map((slice, index) => {
				const fraction = total > 0 ? slice.value / total : 0;
				const segment = {
					...slice,
					color: slice.color ?? seriesColor(index),
					d: arc(cumulative, cumulative + fraction)
				};
				cumulative += fraction;
				return segment;
			});
	});

	const tip = chartTip();
	const tipFor = (slice: Slice, color: string): TipData => ({
		title: slice.label,
		color,
		rows: slice.rows ?? [{ label: valueLabel, value: formatNumber(slice.value) }]
	});
</script>

<div class={compact ? 'flex flex-wrap items-center justify-center gap-x-5 gap-y-1' : ''}>
	<div class={compact ? 'max-w-[10rem] min-w-[7rem] flex-1' : 'mx-auto max-w-[15rem]'}>
		<svg viewBox="0 0 100 56" class="w-full" role="img" aria-label="{centerLabel} {centerValue}">
			<path d={track} fill="none" stroke="var(--muted)" stroke-width={STROKE} />
			{#each segments as segment (segment.label)}
				<path
					d={segment.d}
					fill="none"
					stroke={segment.color}
					stroke-width={STROKE}
					role="img"
					aria-label="{segment.label}: {formatNumber(segment.value)}"
					onpointermove={(event) => tip.show(event, tipFor(segment, segment.color))}
					onpointerleave={tip.hide}
				/>
			{/each}
			<text
				x="50"
				y="38"
				text-anchor="middle"
				font-size="15"
				font-weight="600"
				class="fill-foreground"
			>
				{centerValue}
			</text>
			<text x="50" y="47" text-anchor="middle" font-size="5.5" class="fill-muted-foreground">
				{centerLabel}
			</text>
		</svg>
	</div>

	<ul class={compact ? 'flex flex-col gap-1.5 text-xs' : 'mt-1 flex justify-center gap-5 text-xs'}>
		{#each data as slice, index (slice.label)}
			{@const color = slice.color ?? seriesColor(index)}
			<li
				class="flex items-center gap-1.5"
				onpointermove={(event) => tip.show(event, tipFor(slice, color))}
				onpointerleave={tip.hide}
			>
				<span class="size-2.5 shrink-0 rounded-sm" style="background-color: {color}"></span>
				<span class="text-muted-foreground">{slice.label}</span>
				<span class="font-medium tabular-nums">{compactNumber(slice.value)}</span>
			</li>
		{/each}
	</ul>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
