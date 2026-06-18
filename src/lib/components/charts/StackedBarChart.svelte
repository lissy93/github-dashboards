<script lang="ts">
	import { niceMax } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { formatNumber } from '$lib/format';
	import type { StackBar, StackSeries } from '$lib/views/stats';

	let {
		bars,
		series,
		height = 9
	}: { bars: StackBar[]; series: StackSeries[]; height?: number } = $props();

	const max = $derived(niceMax(Math.max(1, ...bars.map((bar) => bar.total))));
	// Only series that actually occur, so the legend stays honest
	const active = $derived(
		series.filter((entry) => bars.some((bar) => (bar.values[entry.key] ?? 0) > 0))
	);
	const tip = chartTip();

	// Hovering a column shows that year's full split plus its total
	const barTip = (bar: StackBar) => ({
		title: bar.label,
		rows: [
			...active
				.filter((entry) => (bar.values[entry.key] ?? 0) > 0)
				.map((entry) => ({
					label: entry.label,
					value: formatNumber(bar.values[entry.key]),
					color: entry.color
				})),
			{ label: 'Total', value: formatNumber(bar.total) }
		]
	});
</script>

<div class="flex flex-col gap-3">
	<div class="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem]">
		{#each active as entry (entry.key)}
			<span class="flex items-center gap-1.5">
				<span class="size-2.5 rounded-sm" style="background-color: {entry.color}"></span>
				{entry.label}
			</span>
		{/each}
	</div>
	<div class="flex flex-col gap-2">
		<div class="border-chart-grid flex items-end gap-1.5 border-b" style="height: {height}rem">
			{#each bars as bar (bar.label)}
				<div
					class="h-full flex-1"
					role="img"
					aria-label="{bar.label}: {formatNumber(bar.total)}"
					onpointermove={(event) => tip.show(event, barTip(bar))}
					onpointerleave={tip.hide}
				>
					<div class="flex h-full flex-col-reverse">
						{#each series as entry (entry.key)}
							{#if (bar.values[entry.key] ?? 0) > 0}
								<div
									class="w-full last:rounded-t-sm"
									style="height: {(bar.values[entry.key] / max) *
										100}%; min-height: 2px; background-color: {entry.color}"
								></div>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		</div>
		<div class="text-muted-foreground flex gap-1.5 text-[0.65rem]">
			{#each bars as bar (bar.label)}
				<span class="flex-1 truncate text-center">{bar.label}</span>
			{/each}
		</div>
	</div>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
