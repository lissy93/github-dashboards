<script lang="ts">
	import { niceMax } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { formatNumber } from '$lib/utils/format';
	import type { Slice } from '$lib/types/charts';

	// colored uses each bar's own slice colour, else a single accent for the whole set
	let {
		data,
		color = 'var(--chart-1)',
		colored = false,
		height = 9,
		valueLabel = 'Value',
		maxLabels,
		barGap = 0.375,
		maxBarWidth = 128
	}: {
		data: Slice[];
		color?: string;
		colored?: boolean;
		height?: number;
		valueLabel?: string;
		maxLabels?: number;
		barGap?: number;
		maxBarWidth?: number;
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
		class="flex items-end border-b border-chart-grid"
		style="height: {height}rem; gap: {barGap}rem"
	>
		{#each data as point (point.label)}
			<div
				class="flex h-full flex-1 items-end justify-center"
				role="img"
				aria-label="{point.label}: {formatNumber(point.value)}"
				onpointermove={(event) =>
					tip.show(event, { title: point.label, color: fill(point), rows: rowsFor(point) })}
				onpointerleave={tip.hide}
			>
				<!-- Zero-value bars still get a short muted stub so they stay visible without an axis -->
				<div
					class="w-full rounded-t-sm transition-[height] hover:brightness-110"
					style="height: {(point.value / max) * 100}%; max-width: {maxBarWidth}px;
						background-color: {point.value > 0 ? fill(point) : 'var(--muted)'}; min-height: 2px"
				></div>
			</div>
		{/each}
	</div>
	<div class="flex text-[0.65rem] text-muted-foreground" style="gap: {barGap}rem">
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
