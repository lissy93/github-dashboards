<script lang="ts">
	import { cn } from '$lib/utils';

	// Tiny activity bar chart, each value a bucket of commits over the repo's life
	let {
		values,
		color = 'var(--chart-1)',
		class: className
	}: { values: number[]; color?: string; class?: string } = $props();

	const max = $derived(Math.max(1, ...values));
</script>

<div class={cn('flex h-6 items-end gap-px', className)} aria-hidden="true">
	{#each values as value, index (index)}
		<div
			class="min-h-px w-full rounded-[1px]"
			style="height: {(value / max) * 100}%; background-color: {color}; opacity: {value ? 1 : 0.2}"
		></div>
	{/each}
</div>
