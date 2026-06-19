<script lang="ts">
	import { CircleDot, GitPullRequest } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import RadialGauge from '$lib/components/charts/RadialGauge.svelte';
	import { ownedMetrics } from '$lib/owned-metrics.svelte';
	import { issueFlow, prFlow } from '$lib/views/stats';
	import type { Repo } from '$lib/types';

	let { user, repos }: { user: string; repos: Repo[] } = $props();

	// Closed counts live in the lazy stats map, so both gauges wait on it
	const metrics = ownedMetrics(() => user);
	const issues = $derived(metrics.stats ? issueFlow(repos, metrics.stats) : null);
	const prs = $derived(metrics.stats ? prFlow(repos, metrics.stats) : null);
	const sampleText = $derived(metrics.statsSampled ? 'Sampled repos' : undefined);
</script>

<div class="grid gap-5 sm:grid-cols-2">
	<Panel
		title="Issues"
		icon={CircleDot}
		loading={!metrics.statsLoaded}
		error={metrics.statsError}
		empty={issues?.total === 0}
		emptyText="No issues yet"
	>
		{#snippet actions()}
			{#if sampleText}<span class="text-muted-foreground text-xs">{sampleText}</span>{/if}
		{/snippet}
		{#if issues}
			<RadialGauge
				data={issues.slices}
				centerValue="{issues.rate}%"
				centerLabel="closed"
				valueLabel="Issues"
			/>
		{/if}
	</Panel>
	<Panel
		title="Pull requests"
		icon={GitPullRequest}
		loading={!metrics.statsLoaded}
		error={metrics.statsError}
		empty={prs?.total === 0}
		emptyText="No pull requests yet"
	>
		{#snippet actions()}
			{#if sampleText}<span class="text-muted-foreground text-xs">{sampleText}</span>{/if}
		{/snippet}
		{#if prs}
			<RadialGauge
				data={prs.slices}
				centerValue="{prs.rate}%"
				centerLabel="closed"
				valueLabel="PRs"
			/>
		{/if}
	</Panel>
</div>
