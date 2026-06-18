<script lang="ts">
	import { ChartPie, History } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import Donut from '$lib/components/charts/Donut.svelte';
	import { contributionsPerYear, contributionTypes, CONTRIBUTION_SERIES } from '$lib/views/stats';
	import { compactNumber } from '$lib/format';
	import type { UserContributions } from '$lib/types';

	let { data }: { data: UserContributions } = $props();

	const types = $derived(contributionTypes(data.totals));
	const perYear = $derived(contributionsPerYear(data.years));
</script>

<div class="grid gap-5">
	<Panel title="By type" icon={ChartPie} empty={!types.length}>
		<Donut data={types} centerLabel={compactNumber(data.total)} valueLabel="Contributions" />
	</Panel>

	<Panel title="Contributions per year" icon={History} empty={perYear.length < 2}>
		<StackedBarChart bars={perYear} series={CONTRIBUTION_SERIES} />
	</Panel>
</div>
