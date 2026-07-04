<script lang="ts">
	import { Workflow, CircleCheck, Activity, Timer, Power, RotateCcw } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import WorkflowTable from '$lib/components/repo/WorkflowTable.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import { workflowKpiStats, runActivityChart } from '$lib/views/repo';
	import { compactNumber, formatDuration, formatPercent, plural } from '$lib/utils/format';
	import { ok } from '$lib/state/api';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();

	function tiles(stats: ReturnType<typeof workflowKpiStats>): Tile[] {
		return [
			{ label: 'Workflows', value: compactNumber(stats.workflows), icon: Workflow },
			{
				label: 'Pass rate',
				value: formatPercent(stats.passRate),
				icon: CircleCheck,
				hint: 'Share of recently sampled runs that passed, weighted by run count'
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
					? `${stats.active} ${plural(stats.active, 'workflow')} active, ${stats.disabled} ${plural(stats.disabled, 'workflow')} disabled`
					: 'All workflows are active'
			},
			{
				label: 'Retries',
				value: formatPercent(stats.retryRate),
				icon: RotateCcw,
				hint: 'Share of sampled runs that were re-triggered'
			}
		];
	}
</script>

<PageMeta
	title={`Workflows · ${data.repo.nameWithOwner}`}
	description={`Actions workflows, statuses and pass rates for ${data.repo.nameWithOwner}`}
/>

<div class="space-y-5">
	{#await data.workflows then res}
		{@const wf = ok(res)}
		{#if wf && wf.workflows.length}
			<StatTileGrid tiles={tiles(workflowKpiStats(wf))} class="sm:grid-cols-3 lg:grid-cols-6" />
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
</div>
