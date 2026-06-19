<script lang="ts">
	import { onMount } from 'svelte';
	import { Star } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StackedAreaChart from '$lib/components/charts/StackedAreaChart.svelte';
	import { loadJson } from '$lib/owned-maps';
	import { starHistory, type StarBreakdown } from '$lib/views/stats';

	let { user }: { user: string } = $props();

	// undefined while loading, then the reconstructed breakdown (possibly empty)
	let raw = $state<StarBreakdown>();
	const stack = $derived(raw ? starHistory(raw) : null);

	onMount(async () => {
		raw = (await loadJson<StarBreakdown>(user, 'star-history')) ?? { days: [], series: [] };
	});
</script>

<Panel
	title="Star history"
	icon={Star}
	loading={raw === undefined}
	empty={!stack || stack.days.length < 2}
	emptyText="Not enough history yet"
>
	{#snippet actions()}
		{#if stack && stack.days.length >= 2}
			{@const days = Math.max(
				1,
				(Date.parse(stack.days.at(-1)!) - Date.parse(stack.days[0])) / 86400000
			)}
			<span class="text-muted-foreground text-xs tabular-nums">
				Average {((stack.total.at(-1)! - stack.total[0]) / days).toFixed(1)} stars per day
			</span>
		{/if}
	{/snippet}
	{#if stack}
		<StackedAreaChart data={stack} />
	{/if}
</Panel>
