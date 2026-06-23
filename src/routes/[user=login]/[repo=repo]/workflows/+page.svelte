<script lang="ts">
	import {
		Workflow,
		Rocket,
		CircleCheck,
		Activity,
		Timer,
		Power,
		Layers,
		Clock,
		TrendingUp,
		Server,
		History
	} from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import SectionHeading from '$lib/components/common/SectionHeading.svelte';
	import WorkflowTable from '$lib/components/repo/WorkflowTable.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import EnvironmentList from '$lib/components/repo/EnvironmentList.svelte';
	import DeploymentTable from '$lib/components/repo/DeploymentTable.svelte';
	import DeploymentFilters from '$lib/components/repo/DeploymentFilters.svelte';
	import { workflowKpiStats, runActivityChart, formatDuration } from '$lib/views/repo';
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
	import type { LoadResult } from '$lib/views/overview';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let view = $state<DeploymentView>(defaultDeploymentView());

	// Unwrap a settled result to its data, or null when it failed or is still warming
	const ok = <T,>(result: LoadResult<T>): T | null => (result.ok ? result.data : null);
	const pct = (rate: number | null) => (rate == null ? '-' : `${Math.round(rate * 100)}%`);
	const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

	function workflowTiles(stats: ReturnType<typeof workflowKpiStats>): Tile[] {
		return [
			{ label: 'Workflows', value: compactNumber(stats.workflows), icon: Workflow },
			{
				label: 'Pass rate',
				value: pct(stats.passRate),
				icon: CircleCheck,
				hint: 'Share of recently sampled runs that passed, weighted by each workflow run count'
			},
			{
				label: 'Runs',
				value: stats.totalRuns == null ? '-' : compactNumber(stats.totalRuns),
				icon: Activity,
				hint: 'Total runs recorded across every workflow'
			},
			{
				label: 'Avg runtime',
				value: formatDuration(stats.avgRuntimeSec),
				icon: Timer,
				hint: 'Mean run duration, weighted by each workflow run count'
			},
			{
				label: 'Active',
				value: compactNumber(stats.active),
				icon: Power,
				hint: stats.disabled
					? `${plural(stats.active, 'workflow')} active, ${plural(stats.disabled, 'workflow')} disabled`
					: 'All workflows are active'
			}
		];
	}

	function deploymentTiles(d: RepoDeployments, environments: number): Tile[] {
		return [
			{
				label: 'Deployments',
				value: compactNumber(d.totalDeployments),
				icon: Rocket,
				hint: d.sampled
					? 'Total deployments recorded, the most recent are sampled for the charts below'
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
	<title>Workflows · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<div class="space-y-5">
	<!-- Workflows -->
	<SectionHeading
		title="Workflows"
		icon={Workflow}
		description="GitHub Actions workflows and their recent run outcomes"
	/>

	{#await data.workflows then res}
		{@const wf = ok(res)}
		{#if wf && wf.workflows.length}
			<StatTileGrid
				tiles={workflowTiles(workflowKpiStats(wf))}
				class="sm:grid-cols-3 lg:grid-cols-5"
			/>
		{/if}
	{/await}

	<AsyncPanel
		title="Run activity"
		icon={Activity}
		result={data.runs}
		count={(a) => a.total}
		capped={(a) => a.sampled}
		empty={(a) => a.buckets.length === 0}
		emptyText="No workflow runs yet"
	>
		{#snippet children(a)}
			{@const chart = runActivityChart(a)}
			<StackedBarChart
				bars={chart.bars}
				series={chart.series}
				ticks={chart.ticks}
				height={11}
				totalUnit="runs"
			/>
		{/snippet}
	</AsyncPanel>

	<AsyncPanel
		title="Workflows"
		icon={Workflow}
		result={data.workflows}
		count={(wf) => wf.totalWorkflows}
		capped={(wf) => wf.sampled}
		empty={(wf) => wf.workflows.length === 0}
		emptyText="No GitHub Actions workflows"
	>
		{#snippet children(wf)}
			<WorkflowTable workflows={wf.workflows} />
		{/snippet}
	</AsyncPanel>

	<!-- Deployments -->
	<SectionHeading
		title="Deployments"
		icon={Rocket}
		description="Where this repository deploys, how often, and what is live now"
	/>

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
				tiles={deploymentTiles(d, deployedEnvs.length)}
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
