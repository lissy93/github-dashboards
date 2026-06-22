<script lang="ts">
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import HBarList from '$lib/components/charts/HBarList.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { compactNumber, formatNumber } from '$lib/format';
	import type { Slice } from '$lib/views/stats';

	// HBarList that starts collapsed and reveals more rows on demand
	let {
		data,
		collapsed = 8,
		step = 12,
		valueLabel = 'Value',
		color = 'var(--chart-1)',
		colored = false,
		format = compactNumber
	}: {
		data: Slice[];
		collapsed?: number;
		step?: number;
		valueLabel?: string;
		color?: string;
		colored?: boolean;
		format?: (value: number) => string;
	} = $props();

	// null keeps the default collapsed count, a number is an explicit expanded limit
	let limit = $state<number | null>(null);
	const current = $derived(limit ?? collapsed);
	const shown = $derived(data.slice(0, current));
	const more = $derived(data.length - current);
</script>

<HBarList data={shown} {valueLabel} {color} {colored} {format} />

{#if more > 0 || current > collapsed}
	<button
		type="button"
		onclick={() => (limit = more > 0 ? current + step : null)}
		class="text-muted-foreground hover:text-foreground mt-3 flex items-center gap-1 text-xs font-medium"
	>
		{#if more > 0}
			<Icon icon={ChevronDown} size={14} />Show more ({formatNumber(more)})
		{:else}
			<Icon icon={ChevronUp} size={14} />Show less
		{/if}
	</button>
{/if}
