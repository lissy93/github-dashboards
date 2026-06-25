<script lang="ts">
	import {
		Workflow,
		CircleCheck,
		Activity,
		Timer,
		Power,
		RotateCcw
	} from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import WorkflowTable from '$lib/components/repo/WorkflowTable.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import { workflowKpiStats, runActivityChart, formatDuration } from '$lib/views/repo';
	import { compactNumber } from '$lib/format';
	import { APP_NAME } from '$lib/config';
	import type { LoadResult } from '$lib/views/overview';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const ok = <T,>(result: LoadResult<T>): T | null => (result.ok ? result.data : null);
	const pct = (rate: number | null) => (rate == null ? '-' : `${Math.round(rate * 100)}%`);
	const plural = (count: number, noun: string) =>
		`${count} ${noun}${count === 1 ? '' : 's'}`;

	function tiles(stats: ReturnType<typeof workflowKpiStats>): Tile[] {
		return [
			{ label: 'Workflows', value: compactNumber(stats.workflows), icon: Workflow },
			{
				label: 'Pass rate',
				value: pct(stats.passRate),
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
					? `${plural(stats.active, 'workflow')} active, ${plural(stats.disabled, 'workflow')} disabled`
					: 'All workflows are active'
			},
			{
				label: 'Retries',
				value: pct(stats.retryRate),
				icon: RotateCcw,
				hint: 'Share of sampled runs that were re-triggered'
			}
		];
	}
</script>

<svelte:head>
	<title>Workflows · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<div class="space-y-5">
	{#await data.workflows then res}
		{@const wf = ok(res)}
		{#if wf && wf.workflows.length}
			<StatTileGrid
				tiles={tiles(workflowKpiStats(wf))}
				class="sm:grid-cols-3 lg:grid-cols-6"
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
</div>
