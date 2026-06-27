<script lang="ts">
	import { Star, Code, Clock, Tag, GitPullRequest, CircleDot } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import RepoStatStrip from '$lib/components/repo/RepoStatStrip.svelte';
	import MetricTimeChart from '$lib/components/analytics/MetricTimeChart.svelte';
	import PunchCard from '$lib/components/charts/PunchCard.svelte';
	import Donut from '$lib/components/charts/Donut.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import HBarList from '$lib/components/charts/HBarList.svelte';
	import TimelineFilters from '$lib/components/repo/TimelineFilters.svelte';
	import FlowBacklogChart from '$lib/components/repo/FlowBacklogChart.svelte';
	import ActivityHeatmap from '$lib/components/repo/ActivityHeatmap.svelte';
	import {
		starChart,
		flowChart,
		netVelocityChart,
		resolutionTrendChart,
		activityHeatmap,
		lifecycleView,
		defaultTimelineView,
		resolutionBars,
		formatSpanHours,
		TIMELINE_SAMPLED_NOTE,
		type TimelineView
	} from '$lib/views/repo';
	import type { ResolutionStats } from '$lib/server/github/repo-timeline';
	import {
		languageSlices,
		releaseDownloadBars,
		hasReleaseDownloads,
		summariseStats
	} from '$lib/views/repo-stats';
	import { compactNumber } from '$lib/format';
	import { readStored, writeStored } from '$lib/storage';
	import { APP_NAME } from '$lib/config';
	import type { LoadResult } from '$lib/views/overview';
	import type { PageData } from './$types';

	const VIEW_KEY = 'repo:timeline-view';

	let { data }: { data: PageData } = $props();
	let view = $state<TimelineView>(defaultTimelineView());

	// Restore the last chosen chart view after mount, then keep it in sync
	$effect(() => {
		const stored = readStored(VIEW_KEY);
		if (stored) {
			try {
				view = { ...view, ...JSON.parse(stored) };
			} catch {
				// ignore a malformed stored view and keep the default
			}
		}
	});
	$effect(() => {
		writeStored(VIEW_KEY, JSON.stringify(view));
	});

	// Unwrap a settled result to its data, or null when it failed or is still warming
	const ok = <T,>(result: LoadResult<T>): T | null => (result.ok ? result.data : null);
</script>

<svelte:head>
	<title>Stats · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<!-- One kind's resolution histogram under its median headline -->
{#snippet resolution(stats: ResolutionStats, unit: string)}
	<div class="space-y-3">
		<p class="text-muted-foreground text-xs">
			median
			<span class="text-foreground font-medium tabular-nums">
				{formatSpanHours(stats.medianHours)}
			</span>
			over {compactNumber(stats.count)}
			{unit}
		</p>
		<HBarList
			data={resolutionBars(stats)}
			colored
			valueLabel={unit}
			format={compactNumber}
			labelWidth="3rem"
		/>
	</div>
{/snippet}

<div class="space-y-5">
	{#await Promise.all([data.stats, data.contributors, data.recentCommits])}
		<div class="bg-card grid grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-3 lg:grid-cols-5">
			{#each Array.from({ length: 5 }, (_, index) => index) as index (index)}
				<div class="bg-muted/40 h-12 animate-pulse rounded-md"></div>
			{/each}
		</div>
	{:then [statsResult, peopleResult, recentResult]}
		{@const stats = ok(statsResult)}
		{@const people = ok(peopleResult)}
		{@const recent = ok(recentResult)}
		<RepoStatStrip
			summary={summariseStats({
				totalCommits: stats?.commits ?? null,
				recentCommits: recent?.recent ?? null,
				priorCommits: recent?.prior ?? null,
				releaseCount: stats?.releaseCount ?? null,
				contributorCount: people?.total ?? null,
				contributors: people?.contributors ?? null
			})}
		/>
	{/await}

	<AsyncPanel
		title="Issues & PRs over time"
		icon={GitPullRequest}
		result={data.timeline}
		empty={(tl) => tl.points.length === 0}
		emptyText="No history yet"
	>
		{#snippet children(tl)}
			<div class="space-y-4">
				<TimelineFilters bind:view base={tl.granularity} />
				{#if view.mode === 'flow'}
					<FlowBacklogChart chart={flowChart(tl.points, view, tl.granularity)} />
				{:else if view.mode === 'velocity'}
					<FlowBacklogChart chart={netVelocityChart(tl.points, view, tl.granularity)} />
				{:else if view.mode === 'resolution'}
					{@const trend = resolutionTrendChart(tl.points, view, tl.granularity)}
					{#if trend.series.length}
						<div class="space-y-2">
							<MetricTimeChart
								data={trend}
								area={false}
								unit="days"
								label="Time to resolve over time"
								height={20}
							/>
							<p class="text-muted-foreground text-xs">Median days to resolve, by close date</p>
						</div>
					{:else}
						<p class="text-muted-foreground py-8 text-center text-sm">No resolved items in range</p>
					{/if}
				{:else if view.mode === 'heatmap'}
					{@const heat = activityHeatmap(tl.points, view)}
					<div class="space-y-2">
						<ActivityHeatmap
							data={heat}
							scope={view.scope}
							label="Issue and PR activity by month"
						/>
						<p class="text-muted-foreground text-xs">Issues and PRs opened or closed each month</p>
					</div>
				{:else}
					<div class="space-y-5">
						{#if view.scope !== 'prs'}
							{@const lc = lifecycleView(
								tl.points,
								view,
								tl.granularity,
								tl.baseline.issues,
								'issue'
							)}
							<div class="space-y-2">
								{#if view.scope === 'both'}
									<p class="text-muted-foreground text-xs font-medium">Issues</p>
								{/if}
								<StackedBarChart
									bars={lc.bars}
									series={lc.series}
									ticks={lc.ticks}
									totalUnit="issues"
									height={view.scope === 'both' ? 12 : 18}
									barGap={0.125}
								/>
							</div>
						{/if}
						{#if view.scope !== 'issues'}
							{@const lc = lifecycleView(tl.points, view, tl.granularity, tl.baseline.prs, 'pr')}
							<div class="space-y-2">
								{#if view.scope === 'both'}
									<p class="text-muted-foreground text-xs font-medium">Pull requests</p>
								{/if}
								<StackedBarChart
									bars={lc.bars}
									series={lc.series}
									ticks={lc.ticks}
									totalUnit="PRs"
									height={view.scope === 'both' ? 12 : 18}
									barGap={0.125}
								/>
							</div>
						{/if}
					</div>
				{/if}
				{#if tl.sampled}
					<p class="text-muted-foreground text-xs">{TIMELINE_SAMPLED_NOTE}</p>
				{/if}
			</div>
		{/snippet}
	</AsyncPanel>

	<div class="grid items-start gap-5 lg:grid-cols-2">
		<AsyncPanel
			title="Time to close issues"
			icon={CircleDot}
			result={data.timeline}
			empty={(tl) => tl.resolution.issues.count === 0}
			emptyText="No closed issues yet"
		>
			{#snippet children(tl)}
				{@render resolution(tl.resolution.issues, 'issues')}
			{/snippet}
		</AsyncPanel>

		<AsyncPanel
			title="Time to merge PRs"
			icon={GitPullRequest}
			result={data.timeline}
			empty={(tl) => tl.resolution.prs.count === 0}
			emptyText="No merged PRs yet"
		>
			{#snippet children(tl)}
				{@render resolution(tl.resolution.prs, 'PRs')}
			{/snippet}
		</AsyncPanel>
	</div>

	<div class="grid items-start gap-5 lg:grid-cols-2">
		<AsyncPanel
			title="Star history"
			icon={Star}
			result={data.stars}
			empty={(history) => history.days.length === 0}
			emptyText="No stars yet"
		>
			{#snippet children(history)}
				<div class="space-y-3">
					<MetricTimeChart data={starChart(history)} label="Star history" height={16} />
					{#if history.sampled}
						<p class="text-muted-foreground text-xs">
							Sampled across stargazer pages, GitHub only dates the first 40k stars
						</p>
					{/if}
				</div>
			{/snippet}
		</AsyncPanel>

		<AsyncPanel
			title="Languages"
			icon={Code}
			result={data.languages}
			empty={(usage) => usage.length === 0}
			emptyText="No language data"
		>
			{#snippet children(usage)}
				<Donut
					data={languageSlices(usage, usage.length)}
					legend={languageSlices(usage)}
					valueLabel="Bytes"
				/>
			{/snippet}
		</AsyncPanel>
	</div>

	<AsyncPanel
		title="Commit punch card"
		icon={Clock}
		result={data.punchCard}
		empty={(rhythm) => rhythm.total === 0}
		emptyText="No commit data yet"
	>
		{#snippet children(rhythm)}
			<div class="flex flex-col gap-3">
				<PunchCard punch={rhythm.punch} peak={rhythm.peak} />
				<p class="text-muted-foreground text-[0.65rem]">
					When commits land, by weekday and hour, shown in UTC
				</p>
			</div>
		{/snippet}
	</AsyncPanel>

	<AsyncPanel
		title="Releases"
		icon={Tag}
		result={data.releases}
		count={(r) => r.total}
		capped={(r) => r.sampled}
		empty={(r) => r.total === 0}
		emptyText="No releases yet"
	>
		{#snippet children(releases)}
			{#if hasReleaseDownloads(releases.releases)}
				<BarChart
					data={releaseDownloadBars(releases.releases)}
					color="var(--chart-4)"
					valueLabel="Downloads"
				/>
			{:else}
				<p class="text-muted-foreground text-sm">
					{compactNumber(releases.total)} releases, none with downloadable assets
				</p>
			{/if}
		{/snippet}
	</AsyncPanel>
</div>
