<script lang="ts">
	import { ScatterChart } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import ScatterPlot from '$lib/components/charts/ScatterPlot.svelte';
	import * as Select from '$lib/components/ui/select';
	import { createOwnedMetrics } from '$lib/state/owned-metrics.svelte';
	import { portfolioScatter, SCATTER_AXES, SCATTER_SIZE_AXES } from '$lib/views/stats';
	import type { ScatterAxis } from '$lib/views/stats';
	import type { OverviewResult } from '$lib/views/overview';
	import type { Repo } from '$lib/types';

	let { user, result }: { user: string; result: Promise<OverviewResult> | OverviewResult } =
		$props();

	let xKey = $state('created');
	let yKey = $state('stars');
	let sizeKey = $state('forks');
	const metrics = createOwnedMetrics(() => user);

	const byKey = (key: string) =>
		SCATTER_AXES.find((option) => option.key === key) ?? SCATTER_AXES[0];
	const xAxis = $derived(byKey(xKey));
	const yAxis = $derived(byKey(yKey));
	const sizeAxis = $derived(byKey(sizeKey));
	const available = (key: string) =>
		key === 'contributors' ? !!metrics.contributors : !byKey(key).lazy || !!metrics.stats;
	const extraError = $derived(metrics.statsError ?? metrics.contributorsError);
	const axes = $derived([xAxis, yAxis, sizeAxis]);
	const sampled = $derived(
		(axes.some((axis) => axis.key === 'contributors') && metrics.contributorSampled) ||
			(axes.some((axis) => axis.lazy) && metrics.statsSampled)
	);
	const scatter = (repos: Repo[]) =>
		portfolioScatter(repos, xAxis, yAxis, sizeAxis, {
			stats: metrics.stats,
			contributors: metrics.contributors
		});
</script>

{#snippet picker(
	tag: string,
	axis: ScatterAxis,
	options: ScatterAxis[],
	set: (next: string) => void
)}
	<div class="flex items-center gap-1.5">
		<span class="text-xs text-muted-foreground">{tag}</span>
		<Select.Root type="single" value={axis.key} onValueChange={set}>
			<Select.Trigger class="h-8 w-auto text-xs">{axis.label}</Select.Trigger>
			<Select.Content>
				{#each options as option (option.key)}
					<Select.Item value={option.key} disabled={!available(option.key)}>
						{option.label}{option.lazy && !available(option.key)
							? extraError
								? ' (unavailable)'
								: ' (loading)'
							: ''}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
{/snippet}

<AsyncPanel
	title="Portfolio"
	icon={ScatterChart}
	{result}
	empty={(data) => !scatter(data.ownedRepos).length}
	cause={() => (sampled ? 'partial' : undefined)}
	detail={() => (sampled ? 'Some repos are not covered by this metric yet' : undefined)}
>
	{#snippet children(data)}
		<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
			<p class="text-xs text-muted-foreground">
				{yAxis.label} vs {xAxis.label} · dot size = {sizeAxis.label}{sampled
					? ' · sampled repos'
					: ''}
			</p>
			<div class="flex items-center gap-2">
				{@render picker('y', yAxis, SCATTER_AXES, (next) => (yKey = next))}
				{@render picker('x', xAxis, SCATTER_AXES, (next) => (xKey = next))}
				{@render picker('size', sizeAxis, SCATTER_SIZE_AXES, (next) => (sizeKey = next))}
			</div>
		</div>
		<ScatterPlot
			data={scatter(data.ownedRepos)}
			xTime={xAxis.time}
			yTime={yAxis.time}
			xFormat={xAxis.format}
			yFormat={yAxis.format}
		/>
	{/snippet}
</AsyncPanel>
