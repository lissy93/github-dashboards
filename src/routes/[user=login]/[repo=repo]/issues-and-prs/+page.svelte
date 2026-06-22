<script lang="ts">
	import { GitPullRequest, CircleDot } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import MetricTimeChart from '$lib/components/analytics/MetricTimeChart.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import TimelineFilters from '$lib/components/repo/TimelineFilters.svelte';
	import {
		timelineChart,
		cumulativeBars,
		cumulativeTicks,
		defaultTimelineView,
		CUMULATIVE_SERIES,
		type TimelineView
	} from '$lib/views/repo';
	import { paths, APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let view = $state<TimelineView>(defaultTimelineView());

	const tasksHref = $derived(paths.repoSection(data.user, data.repo.name, 'tasks'));
</script>

<svelte:head>
	<title>Issues & PRs over time · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

{#await data.timeline}
	<div class="space-y-5">
		<Panel title="Issues & PRs over time" icon={GitPullRequest} loading />
		<div class="grid gap-5 lg:grid-cols-2">
			<Skeleton class="h-56 w-full rounded-md" />
			<Skeleton class="h-56 w-full rounded-md" />
		</div>
	</div>
{:then result}
	{#if result.ok}
		{@const tl = result.data}
		{@const issueBars = cumulativeBars(tl.points, 'issue', tl.granularity)}
		{@const prBars = cumulativeBars(tl.points, 'pr', tl.granularity)}
		{@const barTicks = cumulativeTicks(tl.points, tl.granularity)}
		<div class="space-y-5">
			<Panel title="Issues & PRs over time" icon={GitPullRequest}>
				{#if tl.points.length}
					<div class="space-y-4">
						<TimelineFilters bind:view />
						<MetricTimeChart
							data={timelineChart(tl.points, view.metrics, {
								cumulative: view.cumulative,
								windowKey: view.windowKey
							})}
							area={view.area}
							label="Issues and PRs over time"
							height={20}
						/>
						{#if tl.sampled}
							<p class="text-muted-foreground text-xs">
								Sampled from the most recent issues and PRs to stay within limits
							</p>
						{/if}
					</div>
				{:else}
					<EmptyState icon={GitPullRequest} text="No history yet" />
				{/if}
			</Panel>

			<div class="grid items-start gap-5 lg:grid-cols-2">
				<Panel
					title="Total issues"
					icon={CircleDot}
					href={tasksHref}
					linkLabel="View all open"
					empty={issueBars.length === 0}
					emptyText="No issues yet"
				>
					<StackedBarChart
						bars={issueBars}
						series={CUMULATIVE_SERIES}
						totalUnit="issues"
						height={14}
						ticks={barTicks}
						barGap={0.125}
					/>
				</Panel>
				<Panel
					title="Total PRs"
					icon={GitPullRequest}
					href={tasksHref}
					linkLabel="View all open"
					empty={prBars.length === 0}
					emptyText="No pull requests yet"
				>
					<StackedBarChart
						bars={prBars}
						series={CUMULATIVE_SERIES}
						totalUnit="PRs"
						height={14}
						ticks={barTicks}
						barGap={0.125}
					/>
				</Panel>
			</div>
		</div>
	{:else}
		<ErrorState error={result.error} />
	{/if}
{/await}
