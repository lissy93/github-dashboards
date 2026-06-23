<script lang="ts">
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { formatNumber } from '$lib/format';
	import type { LegendItem } from '$lib/views/stats';
	import type { LegendState } from './legend.svelte';

	let {
		items,
		state,
		format = formatNumber,
		totalLabel = 'Total',
		more = 0,
		class: className = ''
	}: {
		items: LegendItem[];
		state: LegendState;
		format?: (value: number) => string;
		totalLabel?: string;
		more?: number;
		class?: string;
	} = $props();

	const tip = chartTip();
	const visibleCount = $derived(items.filter((item) => !state.hidden.has(item.key)).length);

	// Legend tooltip: what the series means, plus its overall total
	function show(event: PointerEvent, item: LegendItem) {
		state.hovered = item.key;
		tip.show(event, {
			title: item.label,
			color: item.color,
			note: item.hint,
			rows: item.total == null ? [] : [{ label: totalLabel, value: format(item.total) }]
		});
	}
	function hide() {
		state.hovered = null;
		tip.hide();
	}
</script>

<ul class="flex flex-wrap gap-x-3 gap-y-1 text-xs {className}">
	{#each items as item (item.key)}
		{@const off = state.hidden.has(item.key)}
		<li>
			<button
				type="button"
				class="flex items-center gap-1.5 rounded-sm transition-opacity"
				class:opacity-40={off}
				aria-pressed={!off}
				onpointermove={(event) => show(event, item)}
				onpointerleave={hide}
				onclick={() => (off || visibleCount > 1) && state.toggle(item.key)}
			>
				<span class="size-2.5 shrink-0 rounded-sm" style="background-color: {item.color}"></span>
				<span class="text-muted-foreground" class:line-through={off}>{item.label}</span>
			</button>
		</li>
	{/each}
	{#if more > 0}<li class="text-muted-foreground self-center">+{more} more</li>{/if}
</ul>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
