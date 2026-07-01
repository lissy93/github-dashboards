<script lang="ts">
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import HBarList from '$lib/components/charts/HBarList.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { compactNumber, formatNumber } from '$lib/format';
	import type { Slice } from '$lib/views/stats';

	// HBarList that starts collapsed and reveals more rows on demand
	// align places the toggle at the start or end of the row below the bars
	let {
		data,
		collapsed = 8,
		step = 12,
		valueLabel = 'Value',
		color = 'var(--chart-1)',
		colored = false,
		format = compactNumber,
		animate = false,
		align = 'start'
	}: {
		data: Slice[];
		collapsed?: number;
		step?: number;
		valueLabel?: string;
		color?: string;
		colored?: boolean;
		format?: (value: number) => string;
		animate?: boolean;
		align?: 'start' | 'center' | 'end';
	} = $props();

	// null keeps the default collapsed count, a number is an explicit expanded limit
	let limit = $state<number | null>(null);
	const current = $derived(limit ?? collapsed);
	const shown = $derived(data.slice(0, current));
	const more = $derived(data.length - current);
</script>

<HBarList data={shown} {valueLabel} {color} {colored} {format} {animate} />

{#if more > 0 || current > collapsed}
  <div></div>
  <div class="flex" class:justify-center={align === 'center'} class:justify-end={align === 'end'}>
		<button
			type="button"
			onclick={() => (limit = more > 0 ? current + step : null)}
			class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium"
		>
			{#if more > 0}
				<Icon icon={ChevronDown} size={14} />Show more ({formatNumber(more)})
			{:else}
				<Icon icon={ChevronUp} size={14} />Show less
			{/if}
		</button>
	</div>
{/if}
