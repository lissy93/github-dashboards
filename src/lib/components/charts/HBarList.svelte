<script lang="ts">
	import { slide } from 'svelte/transition';
	import { seriesColor } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { compactNumber, formatNumber } from '$lib/utils/format';
	import type { Slice } from '$lib/types/charts';

	// colored uses each slice's own colour, else a single accent for the whole list
	// animate slides rows in and out when the list grows or shrinks
	let {
		data,
		colored = false,
		color = 'var(--chart-1)',
		valueLabel = 'Value',
		format = compactNumber,
		labelWidth = '7rem',
		animate = false
	}: {
		data: Slice[];
		colored?: boolean;
		color?: string;
		valueLabel?: string;
		format?: (value: number) => string;
		labelWidth?: string;
		animate?: boolean;
	} = $props();

	const max = $derived(Math.max(1, ...data.map((row) => row.value)));
	const width = (row: Slice) => (row.value / max) * 100;
	const fill = (row: Slice, index: number) => (colored ? (row.color ?? seriesColor(index)) : color);
	const tip = chartTip();
	const rowsFor = (row: Slice) =>
		row.rows ?? [{ label: valueLabel, value: formatNumber(row.value) }];
</script>

<!-- Horizontal bars, label left, magnitude as width, value right -->
<ul class="flex flex-col gap-2">
	{#each data as row, index (row.label)}
		<li
			class="grid items-center gap-3 text-xs"
			style="grid-template-columns: {labelWidth} 1fr auto"
			transition:slide={{ duration: animate ? 200 : 0 }}
			onpointermove={(event) =>
				tip.show(event, {
					title: row.label,
					color: row.segments?.length ? undefined : fill(row, index),
					rows: rowsFor(row)
				})}
			onpointerleave={tip.hide}
		>
			<span class="flex min-w-0 items-center gap-1.5 text-muted-foreground">
				{#if row.icon}
					<img
						src={row.icon}
						alt=""
						loading="lazy"
						class="size-3.5 shrink-0 rounded-sm"
						onerror={(event) => ((event.currentTarget as HTMLImageElement).style.display = 'none')}
					/>
				{/if}
				{#if row.href}
					<a href={row.href} class="truncate hover:underline">{row.label}</a>
				{:else}
					<span class="truncate">{row.label}</span>
				{/if}
			</span>
			<span class="h-2 overflow-hidden rounded-full bg-muted/40">
				<span class="flex h-full overflow-hidden rounded-full" style="width: {width(row)}%">
					{#each row.segments ?? [] as segment (segment.key)}
						<span
							class="h-full"
							style="width: {row.value
								? (segment.value / row.value) * 100
								: 0}%; background-color: {segment.color}"
						></span>
					{:else}
						<span class="h-full w-full" style="background-color: {fill(row, index)}"></span>
					{/each}
				</span>
			</span>
			<span class="text-right font-medium tabular-nums">{format(row.value)}</span>
		</li>
	{/each}
</ul>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
