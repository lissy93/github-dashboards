<script lang="ts">
	import { niceMax, niceStep } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import ChartLegend from './ChartLegend.svelte';
	import { legendState } from './legend.svelte';
	import { compactNumber, formatNumber } from '$lib/utils/format';
	import type { StackBar, StackSeries } from '$lib/types/charts';

	let {
		bars,
		series,
		height = 9,
		legendLimit,
		format = formatNumber,
		totalUnit,
		maxLabels,
		ticks,
		barGap = 0.375,
		miniView = false
	}: {
		bars: StackBar[];
		series: StackSeries[];
		height?: number;
		legendLimit?: number;
		format?: (value: number) => string;
		totalUnit?: string;
		maxLabels?: number;
		ticks?: string[];
		barGap?: number;
		miniView?: boolean;
	} = $props();

	const legend = legendState();

	// Thin the x-axis labels so dense bar sets stay readable, bars still render in full
	const labelStep = $derived(
		maxLabels && bars.length > maxLabels ? Math.ceil(bars.length / maxLabels) : 1
	);
	// A caller may supply its own axis labels, else fall back to the thinned bar labels
	const tickAt = (index: number, label: string) =>
		ticks ? (ticks[index] ?? '') : index % labelStep === 0 ? label : '';

	// Append a unit to the total, dropping the trailing s for a count of one
	const totalText = (value: number) => {
		const shown = format(value);
		if (!totalUnit) return shown;
		return `${shown} ${value === 1 ? totalUnit.replace(/s$/, '') : totalUnit}`;
	};

	// Series that actually occur, so the legend stays honest
	const occurring = $derived(
		series.filter((entry) => bars.some((bar) => (bar.values[entry.key] ?? 0) > 0))
	);
	// Series still drawn, after any are toggled off from the legend
	const shown = $derived(occurring.filter((entry) => !legend.hidden.has(entry.key)));
	// A bar's height counts only the shown series, so the chart rescales as they toggle
	const barTotal = (bar: StackBar) =>
		shown.reduce((sum, entry) => sum + (bar.values[entry.key] ?? 0), 0);

	const max = $derived(niceMax(Math.max(1, ...bars.map(barTotal))));
	// Keep count-based grid steps on whole numbers, thinning them right down for the compact view
	const Y_TICKS = $derived(miniView ? 2 : 5);
	// Narrower y-axis gutter in the compact view so the bars get the space
	const gutter = $derived(miniView ? 'w-5' : 'w-7');
	const step = $derived(Math.max(1, Math.round(niceStep(max, Y_TICKS))));
	const yTicks = $derived(
		Array.from({ length: Math.floor(max / step) + 1 }, (_, index) => index * step)
	);

	// Legend entries carry each series' overall total and short explainer
	const seriesTotal = (key: string) => bars.reduce((sum, bar) => sum + (bar.values[key] ?? 0), 0);
	const allItems = $derived(
		occurring.map((entry) => ({
			key: entry.key,
			label: entry.label,
			color: entry.color,
			hint: entry.hint,
			total: seriesTotal(entry.key)
		}))
	);
	// The legend may show only the leading series, the bars still render them all
	const items = $derived(legendLimit ? allItems.slice(0, legendLimit) : allItems);
	const tip = chartTip();

	// Show the column split for the shown series, dropping values which format to zero
	const zero = $derived(format(0));
	const barTip = (bar: StackBar) => ({
		title: bar.label,
		rows: [
			...shown
				.map((entry) => ({
					label: entry.label,
					value: format(bar.values[entry.key] ?? 0),
					color: entry.color
				}))
				.filter((row) => row.value !== zero),
			{ label: 'Total', value: totalText(barTotal(bar)) }
		]
	});
</script>

<div class="flex flex-col {miniView ? 'gap-0' : 'gap-3'}">
	{#if !miniView}
		<ChartLegend {items} state={legend} {format} more={occurring.length - items.length} />
	{/if}
	<div class="flex flex-col gap-2">
		<div class="flex gap-1.5">
			<!-- Y-axis ticks, centred on their gridline -->
			<div class="relative {gutter} shrink-0" style="height: {height}rem" aria-hidden="true">
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
				<div class="relative flex items-end" style="height: {height}rem; gap: {barGap}rem">
					{#each bars as bar (bar.label)}
						<div
							class="h-full flex-1"
							role="img"
							aria-label="{bar.label}: {format(barTotal(bar))}"
							onpointermove={(event) => tip.show(event, barTip(bar))}
							onpointerleave={tip.hide}
						>
							<div class="flex h-full flex-col-reverse">
								{#each shown as entry (entry.key)}
									{#if (bar.values[entry.key] ?? 0) > 0}
										{@const lift = legend.hovered === entry.key}
										{@const dim = legend.hovered !== null && !lift}
										<div
											class="w-full origin-center transition-[transform,filter,opacity] duration-150 last:rounded-t-sm"
											style="height: {(bar.values[entry.key] / max) *
												100}%; min-height: 2px; background-color: {entry.color}; opacity: {dim
												? 0.4
												: 1}; filter: {lift ? 'brightness(1.18)' : 'none'}; transform: {lift
												? 'scaleX(1.06)'
												: 'none'}"
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
			<div class="{gutter} shrink-0" aria-hidden="true"></div>
			<div class="text-muted-foreground flex flex-1 text-[0.65rem]" style="gap: {barGap}rem">
				{#each bars as bar, index (bar.label)}
					<span
						class={ticks
							? 'flex-1 overflow-visible text-center whitespace-nowrap'
							: 'flex-1 truncate text-center'}
					>
						{tickAt(index, bar.label)}
					</span>
				{/each}
			</div>
		</div>
	</div>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
