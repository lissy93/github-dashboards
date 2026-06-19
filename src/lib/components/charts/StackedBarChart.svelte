<script lang="ts">
	import { niceMax, niceStep } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { compactNumber, formatNumber } from '$lib/format';
	import type { StackBar, StackSeries } from '$lib/views/stats';

	let {
		bars,
		series,
		height = 9,
		legendLimit,
		format = formatNumber,
		totalUnit
	}: {
		bars: StackBar[];
		series: StackSeries[];
		height?: number;
		legendLimit?: number;
		format?: (value: number) => string;
		totalUnit?: string;
	} = $props();

	// Append a unit to the total, dropping the trailing s for a count of one
	const totalText = (value: number) => {
		const shown = format(value);
		if (!totalUnit) return shown;
		return `${shown} ${value === 1 ? totalUnit.replace(/s$/, '') : totalUnit}`;
	};

	const max = $derived(niceMax(Math.max(1, ...bars.map((bar) => bar.total))));
	// Keep count-based grid steps on whole numbers
	const Y_TICKS = 5;
	const step = $derived(Math.max(1, Math.round(niceStep(max, Y_TICKS))));
	const yTicks = $derived(
		Array.from({ length: Math.floor(max / step) + 1 }, (_, index) => index * step)
	);
	// Only series that actually occur, so the legend stays honest
	const active = $derived(
		series.filter((entry) => bars.some((bar) => (bar.values[entry.key] ?? 0) > 0))
	);
	// The legend may show only the leading series, the bars still render them all
	const legend = $derived(legendLimit ? active.slice(0, legendLimit) : active);
	const hidden = $derived(active.length - legend.length);
	const tip = chartTip();

	// Show the column split, dropping values which format to zero
	const zero = $derived(format(0));
	const barTip = (bar: StackBar) => ({
		title: bar.label,
		rows: [
			...active
				.map((entry) => ({
					label: entry.label,
					value: format(bar.values[entry.key] ?? 0),
					color: entry.color
				}))
				.filter((row) => row.value !== zero),
			{ label: 'Total', value: totalText(bar.total) }
		]
	});
</script>

<div class="flex flex-col gap-3">
	<div class="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem]">
		{#each legend as entry (entry.key)}
			<span class="flex items-center gap-1.5">
				<span class="size-2.5 rounded-sm" style="background-color: {entry.color}"></span>
				{entry.label}
			</span>
		{/each}
		{#if hidden > 0}<span>+{hidden} more</span>{/if}
	</div>
	<div class="flex flex-col gap-2">
		<div class="flex gap-1.5">
			<!-- Y-axis ticks, centred on their gridline -->
			<div class="relative w-7 shrink-0" style="height: {height}rem" aria-hidden="true">
				{#each yTicks as value (value)}
					<span
						class="text-muted-foreground absolute right-0 translate-y-1/2 text-[0.6rem] tabular-nums"
						style="bottom: {(value / max) * 100}%"
					>
						{compactNumber(value)}
					</span>
				{/each}
			</div>
			<!-- Gridlines sit behind the bars, the zero line doubles as the baseline -->
			<div class="relative flex-1">
				{#each yTicks as value (value)}
					<div
						class="border-chart-grid absolute inset-x-0 border-t"
						style="bottom: {(value / max) * 100}%"
					></div>
				{/each}
				<div class="relative flex items-end gap-1.5" style="height: {height}rem">
					{#each bars as bar (bar.label)}
						<div
							class="h-full flex-1"
							role="img"
							aria-label="{bar.label}: {format(bar.total)}"
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
			</div>
		</div>
		<!-- X-axis labels, offset to clear the y-axis gutter -->
		<div class="flex gap-1.5">
			<div class="w-7 shrink-0" aria-hidden="true"></div>
			<div class="text-muted-foreground flex flex-1 gap-1.5 text-[0.65rem]">
				{#each bars as bar (bar.label)}
					<span class="flex-1 truncate text-center">{bar.label}</span>
				{/each}
			</div>
		</div>
	</div>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
