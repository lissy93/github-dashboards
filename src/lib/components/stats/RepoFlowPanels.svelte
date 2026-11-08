<script lang="ts">
	import { CircleDot, GitPullRequest } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import RadialGauge from '$lib/components/charts/RadialGauge.svelte';
	import { createOwnedMetrics } from '$lib/state/owned-metrics.svelte';
	import { issueFlow, prFlow } from '$lib/views/stats';
	import type { OverviewResult } from '$lib/views/overview';

	let { user, result }: { user: string; result: Promise<OverviewResult> | OverviewResult } =
		$props();

	// Closed counts live in the lazy stats map, so both gauges wait on it
	const metrics = createOwnedMetrics(() => user);
	const sampleText = $derived(metrics.statsSampled ? 'Sampled repos' : undefined);
</script>

{#snippet actions()}
	{#if sampleText}<span class="text-xs text-muted-foreground">{sampleText}</span>{/if}
{/snippet}

{#await result}
	<div class="grid gap-5 sm:grid-cols-2">
		<Panel title="Issues" icon={CircleDot} loading />
		<Panel title="Pull requests" icon={GitPullRequest} loading />
	</div>
{:then res}
	{@const repos = res.ok ? res.data.ownedRepos : []}
	{@const issues = res.ok && metrics.stats ? issueFlow(repos, metrics.stats) : null}
	{@const prs = res.ok && metrics.stats ? prFlow(repos, metrics.stats) : null}
	<div class="grid gap-5 sm:grid-cols-2">
		<Panel
			title="Issues"
			icon={CircleDot}
			loading={res.ok && !metrics.statsLoaded}
			error={res.ok ? metrics.statsError : res.error}
			empty={issues?.total === 0}
			emptyText="No issues yet"
			{actions}
		>
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
			loading={res.ok && !metrics.statsLoaded}
			error={res.ok ? metrics.statsError : res.error}
			empty={prs?.total === 0}
			emptyText="No pull requests yet"
			{actions}
		>
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
{/await}
