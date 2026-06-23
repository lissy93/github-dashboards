<script lang="ts">
	import {
		Rocket,
		CircleCheck,
		Layers,
		Clock,
		TrendingUp,
		Server,
		History
	} from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import EnvironmentList from '$lib/components/repo/EnvironmentList.svelte';
	import DeploymentTable from '$lib/components/repo/DeploymentTable.svelte';
	import DeploymentFilters from '$lib/components/repo/DeploymentFilters.svelte';
	import {
		frequencyChart,
		filteredRecent,
		environmentOptions,
		defaultDeploymentView,
		type DeploymentView
	} from '$lib/views/repo-deployments';
	import type { RepoDeployments } from '$lib/server/github/deployments';
	import { compactNumber, relativeTime, formatDateTime } from '$lib/format';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let view = $state<DeploymentView>(defaultDeploymentView());

	const pct = (rate: number | null) => (rate == null ? '-' : `${Math.round(rate * 100)}%`);

	function tiles(d: RepoDeployments, environments: number): Tile[] {
		return [
			{
				label: 'Deployments',
				value: compactNumber(d.totalDeployments),
				icon: Rocket,
				hint: d.sampled
					? 'Total deployments recorded, the most recent are sampled below'
					: 'Total deployments recorded for this repository'
			},
			{
				label: 'Environments',
				value: compactNumber(environments),
				icon: Layers,
				hint: 'Environments with at least one deployment'
			},
			{
				label: 'Success rate',
				value: pct(d.successRate),
				icon: CircleCheck,
				hint:
					d.successRate == null
						? 'No deployments have reached a final status yet'
						: `Of deployments that reached a final status, ${pct(d.successRate)} succeeded`
			},
			{
				label: 'Last deploy',
				value: d.lastDeployAt ? relativeTime(d.lastDeployAt) : '-',
				icon: Clock,
				hint: d.lastDeployAt ? `Last deployed ${formatDateTime(d.lastDeployAt)}` : undefined
			}
		];
	}
</script>

<svelte:head>
	<title>Deployments · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<div class="space-y-5">
	{#await data.deployments}
		<Panel title="Deployments" icon={Rocket} loading />
	{:then result}
		{#if !result.ok}
			<Panel title="Deployments" icon={Rocket} error={result.error} />
		{:else if result.data.totalDeployments === 0}
			<Panel title="Deployments" icon={Rocket} empty emptyText="No deployments yet" />
		{:else}
			{@const d = result.data}
			{@const deployedEnvs = d.environments.filter((env) => env.count > 0)}
			{@const freq = frequencyChart(d, view.windowKey)}
			{@const recent = filteredRecent(d, view.environment)}
			<StatTileGrid
				tiles={tiles(d, deployedEnvs.length)}
				class="sm:grid-cols-2 lg:grid-cols-4"
			/>

			<DeploymentFilters bind:view environments={environmentOptions(d)} />

			<Panel title="Deployment frequency" icon={TrendingUp}>
				{#if freq.bars.length}
					<StackedBarChart
						bars={freq.bars}
						series={freq.series}
						ticks={freq.ticks}
						height={12}
						totalUnit="deploys"
					/>
				{:else}
					<p class="text-muted-foreground text-sm">No deployments in this window</p>
				{/if}
			</Panel>

			<Panel title="Environments" icon={Server}>
				<EnvironmentList environments={d.environments} repoUrl={data.repo.url} />
			</Panel>

			<Panel
				title="Recent deployments"
				icon={History}
				empty={recent.length === 0}
				emptyText="No deployments to this environment"
			>
				{#key view.environment}
					<DeploymentTable deployments={recent} repoUrl={data.repo.url} />
				{/key}
			</Panel>
		{/if}
	{/await}
</div>
