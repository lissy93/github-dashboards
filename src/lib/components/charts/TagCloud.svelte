<script lang="ts">
	import { seriesColor } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { formatNumber } from '$lib/utils/format';
	import type { Slice } from '$lib/types/charts';

	// min and max are font sizes in rem, words scale linearly between them by value
	let {
		data,
		more = 0,
		min = 0.75,
		max = 1.875
	}: { data: Slice[]; more?: number; min?: number; max?: number } = $props();

	// The top words carry an accent colour, the long tail stays muted for contrast
	const ACCENT_LIMIT = 5;
	const lo = $derived(Math.min(...data.map((word) => word.value)));
	const hi = $derived(Math.max(...data.map((word) => word.value)));

	// Scale a value into the rem range, falling to the midpoint when all are equal
	function sizeFor(value: number): number {
		if (hi === lo) return (min + max) / 2;
		return min + ((value - lo) / (hi - lo)) * (max - min);
	}

	const tip = chartTip();
	const tipFor = (word: Slice) => ({
		title: word.label,
		rows: word.rows ?? [{ label: 'Repos', value: formatNumber(word.value) }]
	});
</script>

<!-- Topics laid out as a wrapped cloud, word size tracks how many repos use it -->
<ul class="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
	{#each data as word, index (word.label)}
		<li
			class="hover:bg-muted/60 cursor-default rounded-md px-2 py-0.5 leading-tight font-medium transition-colors"
			style="font-size: {sizeFor(word.value)}rem; color: {index < ACCENT_LIMIT
				? seriesColor(index)
				: 'var(--muted-foreground)'}"
			role="img"
			aria-label="{word.label}, {word.value} repos"
			onpointermove={(event) => tip.show(event, tipFor(word))}
			onpointerleave={tip.hide}
		>
			{word.label}
		</li>
	{/each}
	{#if more > 0}
		<li class="text-muted-foreground px-2 py-0.5 text-xs">+{more} more</li>
	{/if}
</ul>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
