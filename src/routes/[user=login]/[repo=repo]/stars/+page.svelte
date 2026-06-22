<script lang="ts">
	import { Star } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import MetricTimeChart from '$lib/components/analytics/MetricTimeChart.svelte';
	import { starChart } from '$lib/views/repo';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Star history · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<AsyncPanel
	title="Star history"
	icon={Star}
	result={data.stars}
	empty={(history) => history.days.length === 0}
	emptyText="No stars yet"
>
	{#snippet children(history)}
		<div class="space-y-3">
			<MetricTimeChart data={starChart(history)} label="Star history" height={20} />
			{#if history.sampled}
				<p class="text-muted-foreground text-xs">
					Sampled across stargazer pages, GitHub only dates the first 40k stars
				</p>
			{/if}
		</div>
	{/snippet}
</AsyncPanel>
