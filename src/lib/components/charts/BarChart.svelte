<script lang="ts">
	import { niceMax } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { formatNumber } from '$lib/format';
	import type { Slice } from '$lib/views/stats';

	// colored uses each bar's own slice colour, else a single accent for the whole set
	let {
		data,
		color = 'var(--chart-1)',
		colored = false,
		height = 9,
		valueLabel = 'Value',
		maxLabels,
		barGap = 0.375
	}: {
		data: Slice[];
		color?: string;
		colored?: boolean;
		height?: number;
		valueLabel?: string;
		maxLabels?: number;
		barGap?: number;
	} = $props();

	const max = $derived(niceMax(Math.max(0, ...data.map((point) => point.value))));
	const fill = (point: Slice) => (colored ? (point.color ?? color) : color);
	// Thin the x-axis labels so a long list stays readable, bars still render in full
	const labelStep = $derived(
		maxLabels && data.length > maxLabels ? Math.ceil(data.length / maxLabels) : 1
	);
	const tip = chartTip();
	const rowsFor = (point: Slice) =>
		point.rows ?? [{ label: valueLabel, value: formatNumber(point.value) }];
</script>

<!-- Vertical bars on a shared baseline, hover for the full breakdown -->
<div class="flex flex-col gap-2">
	<div
		class="border-chart-grid flex items-end border-b"
		style="height: {height}rem; gap: {barGap}rem"
	>
		{#each data as point (point.label)}
			<div
				class="flex h-full flex-1 items-end"
				role="img"
				aria-label="{point.label}: {formatNumber(point.value)}"
				onpointermove={(event) =>
					tip.show(event, { title: point.label, color: fill(point), rows: rowsFor(point) })}
				onpointerleave={tip.hide}
			>
				<!-- Zero-value bars still get a short muted stub so they stay visible without an axis -->
				<div
					class="hover:brightness-110 w-full rounded-t-sm transition-[height]"
					style="height: {(point.value / max) * 100}%; background-color: {point.value > 0
						? fill(point)
						: 'var(--muted)'}; min-height: 2px"
				></div>
			</div>
		{/each}
	</div>
	<div class="text-muted-foreground flex text-[0.65rem]" style="gap: {barGap}rem">
		{#each data as point, index (point.label)}
			<span
				class={labelStep > 1
					? 'flex-1 overflow-visible text-center whitespace-nowrap'
					: 'flex-1 truncate text-center'}
			>
				{index % labelStep === 0 ? point.label : ''}
			</span>
		{/each}
	</div>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
