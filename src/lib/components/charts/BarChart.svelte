<script lang="ts">
	import { niceMax } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { formatNumber } from '$lib/format';
	import type { Slice } from '$lib/views/stats';

	let {
		data,
		color = 'var(--chart-1)',
		height = 9,
		valueLabel = 'Value'
	}: { data: Slice[]; color?: string; height?: number; valueLabel?: string } = $props();

	const max = $derived(niceMax(Math.max(0, ...data.map((point) => point.value))));
	const tip = chartTip();
	const rowsFor = (point: Slice) =>
		point.rows ?? [{ label: valueLabel, value: formatNumber(point.value) }];
</script>

<!-- Vertical bars on a shared baseline, hover for the full breakdown -->
<div class="flex flex-col gap-2">
	<div class="border-chart-grid flex items-end gap-1.5 border-b" style="height: {height}rem">
		{#each data as point (point.label)}
			<div
				class="flex h-full flex-1 items-end"
				role="img"
				aria-label="{point.label}: {formatNumber(point.value)}"
				onpointermove={(event) =>
					tip.show(event, { title: point.label, color, rows: rowsFor(point) })}
				onpointerleave={tip.hide}
			>
				<div
					class="hover:brightness-110 w-full rounded-t-sm transition-[height]"
					style="height: {(point.value / max) *
						100}%; background-color: {color}; min-height: {point.value > 0 ? 2 : 0}px"
				></div>
			</div>
		{/each}
	</div>
	<div class="text-muted-foreground flex gap-1.5 text-[0.65rem]">
		{#each data as point (point.label)}
			<span class="flex-1 truncate text-center">{point.label}</span>
		{/each}
	</div>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
