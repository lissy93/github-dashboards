<script lang="ts">
	import { ScatterChart } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import ScatterPlot from '$lib/components/charts/ScatterPlot.svelte';
	import * as Select from '$lib/components/ui/select';
	import { ownedMetrics } from '$lib/owned-metrics.svelte';
	import { portfolioScatter, SCATTER_AXES } from '$lib/views/stats';
	import type { Repo } from '$lib/types';

	let { user, repos }: { user: string; repos: Repo[] } = $props();

	let xKey = $state('created');
	let yKey = $state('stars');
	const metrics = ownedMetrics(() => user);

	const byKey = (key: string) =>
		SCATTER_AXES.find((option) => option.key === key) ?? SCATTER_AXES[0];
	const xAxis = $derived(byKey(xKey));
	const yAxis = $derived(byKey(yKey));
	const available = (key: string) =>
		key === 'contributors' ? !!metrics.contributors : !byKey(key).lazy || !!metrics.stats;
	const extraError = $derived(metrics.statsError ?? metrics.contributorsError);
	const sampled = $derived(
		(xAxis.key === 'contributors' || yAxis.key === 'contributors'
			? metrics.contributorSampled
			: false) ||
			((xAxis.lazy || yAxis.lazy) && metrics.statsSampled)
	);
	const points = $derived(
		portfolioScatter(repos, xAxis, yAxis, {
			stats: metrics.stats,
			contributors: metrics.contributors
		})
	);
</script>

{#snippet picker(axis: 'x' | 'y')}
	<div class="flex items-center gap-1.5">
		<span class="text-muted-foreground text-xs">{axis}</span>
		<Select.Root
			type="single"
			value={axis === 'y' ? yKey : xKey}
			onValueChange={(next) => (axis === 'y' ? (yKey = next) : (xKey = next))}
		>
			<Select.Trigger class="h-8 w-auto text-xs"
				>{(axis === 'y' ? yAxis : xAxis).label}</Select.Trigger
			>
			<Select.Content>
				{#each SCATTER_AXES as option (option.key)}
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

<Panel title="Portfolio" icon={ScatterChart} empty={!points.length}>
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<p class="text-muted-foreground text-xs">
			{yAxis.label} vs {xAxis.label} · dot size = forks{sampled ? ' · sampled repos' : ''}
		</p>
		<div class="flex items-center gap-2">
			{@render picker('y')}
			{@render picker('x')}
		</div>
	</div>
	<ScatterPlot
		data={points}
		xTime={xAxis.time}
		yTime={yAxis.time}
		xFormat={xAxis.format}
		yFormat={yAxis.format}
	/>
</Panel>
