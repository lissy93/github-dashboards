<script lang="ts">
	import { Trophy } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import HBarList from '$lib/components/charts/HBarList.svelte';
	import * as Select from '$lib/components/ui/select';
	import { createOwnedMetrics } from '$lib/state/owned-metrics.svelte';
	import { topRepos, REPO_METRICS } from '$lib/views/stats';
	import type { OverviewResult } from '$lib/views/overview';

	let { user, result }: { user: string; result: Promise<OverviewResult> | OverviewResult } =
		$props();

	let metricKey = $state(REPO_METRICS[0].key);
	const metrics = createOwnedMetrics(() => user);

	const metric = $derived(
		REPO_METRICS.find((option) => option.key === metricKey) ?? REPO_METRICS[0]
	);
	const available = (key: string) =>
		key === 'contributors'
			? !!metrics.contributors
			: !REPO_METRICS.find((item) => item.key === key)?.lazy || !!metrics.stats;
	const extraError = $derived(metrics.statsError ?? metrics.contributorsError);
	const sampled = $derived(
		metric.key === 'contributors' ? metrics.contributorSampled : metric.lazy && metrics.statsSampled
	);
</script>

<AsyncPanel title="Top repos" icon={Trophy} {result}>
	{#snippet children(data)}
		{@const leaders = topRepos(data.ownedRepos, metric, {
			stats: metrics.stats,
			contributors: metrics.contributors
		})}
		<div class="mb-3 flex items-center justify-between gap-2">
			<p class="text-muted-foreground text-xs">
				{metric.label}{sampled ? ' · sampled repos' : ''}
			</p>
			<Select.Root type="single" bind:value={metricKey}>
				<Select.Trigger class="h-8 w-auto text-xs">{metric.short}</Select.Trigger>
				<Select.Content>
					{#each REPO_METRICS as option (option.key)}
						<Select.Item value={option.key} disabled={!available(option.key)}>
							{option.short}{option.lazy && !available(option.key)
								? extraError
									? ' (unavailable)'
									: ' (loading)'
								: ''}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		{#if leaders.length}
			<HBarList
				data={leaders}
				color="var(--chart-4)"
				valueLabel={metric.short}
				format={metric.format}
			/>
		{:else}
			<p class="text-muted-foreground text-sm">Nothing here yet</p>
		{/if}
	{/snippet}
</AsyncPanel>
