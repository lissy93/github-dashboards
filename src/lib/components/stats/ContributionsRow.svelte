<script lang="ts">
	import { History, ChartPie } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import Donut from '$lib/components/charts/Donut.svelte';
	import { contributionsPerYear, contributionTypes, CONTRIBUTION_SERIES } from '$lib/views/stats';
	import { compactNumber } from '$lib/utils/format';
	import type { ContributionsResult } from '$lib/views/overview';

	let { result }: { result: Promise<ContributionsResult> | ContributionsResult } = $props();
</script>

<div class="grid gap-5 lg:grid-cols-3">
	<AsyncPanel
		class="lg:col-span-2"
		title="Contributions per year"
		icon={History}
		{result}
		empty={(data) => data.total === 0 || contributionsPerYear(data.years).length < 2}
	>
		{#snippet children(data)}
			<StackedBarChart
				bars={contributionsPerYear(data.years)}
				series={CONTRIBUTION_SERIES}
				totalUnit="contributions"
			/>
		{/snippet}
	</AsyncPanel>
	<AsyncPanel
		title="By type"
		icon={ChartPie}
		{result}
		empty={(data) => !contributionTypes(data.totals).length}
	>
		{#snippet children(data)}
			<Donut
				data={contributionTypes(data.totals)}
				centerLabel={compactNumber(data.total)}
				valueLabel="Contributions"
			/>
		{/snippet}
	</AsyncPanel>
</div>
