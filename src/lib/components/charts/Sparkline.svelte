<script lang="ts">
	import { cn } from '$lib/utils';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { formatNumber } from '$lib/utils/format';

	// Tiny activity bar chart, each value a bucket over the repo's life. Pass labels/valueLabel to
	// make the bars hoverable with a tooltip, otherwise it stays a decorative sparkline
	let {
		values,
		labels,
		valueLabel,
		format = formatNumber,
		color = 'var(--chart-1)',
		class: className
	}: {
		values: number[];
		labels?: string[];
		valueLabel?: string;
		format?: (value: number) => string;
		color?: string;
		class?: string;
	} = $props();

	const max = $derived(Math.max(1, ...values));
	const interactive = $derived(valueLabel != null || labels != null);
	const tip = chartTip();
	const tipFor = (value: number, index: number) => ({
		title: labels?.[index] ?? valueLabel ?? '',
		rows: [{ label: valueLabel ?? 'Value', value: format(value) }]
	});
</script>

<div
	class={cn('flex h-6 items-end gap-px', className)}
	aria-hidden={interactive ? undefined : 'true'}
>
	{#each values as value, index (index)}
		<div
			class="flex h-full flex-1 items-end"
			role={interactive ? 'img' : undefined}
			aria-label={interactive ? `${tipFor(value, index).title}: ${format(value)}` : undefined}
			onpointermove={interactive ? (event) => tip.show(event, tipFor(value, index)) : undefined}
			onpointerleave={interactive ? tip.hide : undefined}
		>
			<div
				class="min-h-px w-full rounded-t-sm"
				style="height: {(value / max) * 100}%; background-color: {color}; opacity: {value
					? 1
					: 0.2}"
			></div>
		</div>
	{/each}
</div>

{#if interactive}
	<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
{/if}
