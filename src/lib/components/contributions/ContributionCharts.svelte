<script lang="ts">
	import { CalendarRange, Trophy } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import ExpandableBarList from '$lib/components/charts/ExpandableBarList.svelte';
	import {
		CONTRIB_YEAR_SERIES,
		acrossYears,
		contribMetric,
		contributionYearBars,
		topContributionRepos,
		visibleContributions
	} from '$lib/views/contributions';
	import type { View } from '$lib/utils/sort-filter';
	import type { AuthoredContributions, LoadResult } from '$lib/types';

	const RANKED_REPOS = 30;
	const SHOWN_REPOS = 10;
	const EMPTY = 'No contributions match';

	type Result = LoadResult<AuthoredContributions>;
	let { result, view }: { result: Promise<Result> | Result; view: View } = $props();

	const metric = $derived(contribMetric(view.filters.activity));

	// The year chart spans every year, so it keeps its shape while a single year is filtered
	const bars = (data: AuthoredContributions) =>
		contributionYearBars(visibleContributions(data, acrossYears(view)));
	const repos = (data: AuthoredContributions) =>
		topContributionRepos(visibleContributions(data, view), view.filters.activity, RANKED_REPOS);
</script>

{#await result then res}
	{#if res.ok}
		{@const yearBars = bars(res.data)}
		{@const topRepos = repos(res.data)}
		<div class="grid gap-4 lg:grid-cols-3">
			<Panel
				title="Contributions per year"
				icon={CalendarRange}
				class="lg:col-span-2"
				empty={!yearBars.length}
				emptyText={EMPTY}
				silent
			>
				<StackedBarChart
					bars={yearBars}
					series={CONTRIB_YEAR_SERIES}
					height={14}
					totalUnit="contributions"
				/>
			</Panel>
			<Panel
				title="Top repos by {metric.label.toLowerCase()}"
				icon={Trophy}
				empty={!topRepos.length}
				emptyText={EMPTY}
				silent
			>
				<ExpandableBarList
					data={topRepos}
					collapsed={SHOWN_REPOS}
					step={SHOWN_REPOS}
					valueLabel={metric.label}
					labelWidth="9rem"
					animate
				/>
			</Panel>
		</div>
	{/if}
{/await}
