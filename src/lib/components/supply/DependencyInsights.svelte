<script lang="ts">
	import Treemap from '$lib/components/charts/Treemap.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import {
		topDependedOnSlices,
		depthHistogram,
		unreachedCount,
		DIRECT_COLOR,
		TRANSITIVE_COLOR
	} from '$lib/views/supply-chain';
	import type { Dependency } from '$lib/server/github/supply-chain';

	let { packages }: { packages: Dependency[] } = $props();

	const fanIn = $derived(topDependedOnSlices(packages));
	const depth = $derived(depthHistogram(packages));
	const unreached = $derived(unreachedCount(packages));

	const depthLegend = [
		{ label: 'Direct', color: DIRECT_COLOR },
		{ label: 'Transitive', color: TRANSITIVE_COLOR }
	];
</script>

<div class="grid gap-6 sm:grid-cols-2 sm:items-start">
	<div class="space-y-2">
		<p class="text-muted-foreground text-xs">Most depended-on packages</p>
		<Treemap data={fanIn} height={12} />
	</div>
	<div class="space-y-2">
		<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
			<p class="text-muted-foreground text-xs">Distance from the project root (hops)</p>
			<div class="flex items-center gap-3">
				{#each depthLegend as entry (entry.label)}
					<span class="text-muted-foreground flex items-center gap-1.5 text-xs">
						<span class="size-2.5 rounded-sm" style="background-color: {entry.color}"></span>
						{entry.label}
					</span>
				{/each}
			</div>
		</div>
		<BarChart data={depth} height={10} valueLabel="Packages" colored />
		{#if unreached}
			<p class="text-muted-foreground text-xs">
				{unreached} package{unreached === 1 ? '' : 's'} not linked back to the root
			</p>
		{/if}
	</div>
</div>
