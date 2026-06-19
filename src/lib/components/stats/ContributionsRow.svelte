<script lang="ts">
	import { History, ChartPie } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import Donut from '$lib/components/charts/Donut.svelte';
	import { contributionsPerYear, contributionTypes, CONTRIBUTION_SERIES } from '$lib/views/stats';
	import { compactNumber } from '$lib/format';
	import type { UserContributions } from '$lib/types';

	let { data }: { data: UserContributions } = $props();

	const perYear = $derived(contributionsPerYear(data.years));
	const types = $derived(contributionTypes(data.totals));
</script>

<div class="grid gap-5 lg:grid-cols-3">
	<Panel
		class="lg:col-span-2"
		title="Contributions per year"
		icon={History}
		empty={perYear.length < 2}
	>
		<StackedBarChart bars={perYear} series={CONTRIBUTION_SERIES} totalUnit="contributions" />
	</Panel>
	<Panel title="By type" icon={ChartPie} empty={!types.length}>
		<Donut data={types} centerLabel={compactNumber(data.total)} valueLabel="Contributions" />
	</Panel>
</div>
