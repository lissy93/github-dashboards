<script lang="ts">
	import { Star, Code, Clock, Tag, GitPullRequest, CircleDot } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import RepoStatStrip from '$lib/components/repo/RepoStatStrip.svelte';
	import MetricTimeChart from '$lib/components/analytics/MetricTimeChart.svelte';
	import PunchCard from '$lib/components/charts/PunchCard.svelte';
	import Donut from '$lib/components/charts/Donut.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import HBarList from '$lib/components/charts/HBarList.svelte';
	import TimelineFilters from '$lib/components/repo/TimelineFilters.svelte';
	import {
		starChart,
		timelineChart,
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
	import { APP_NAME } from '$lib/config';
	import type { LoadResult } from '$lib/views/overview';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let view = $state<TimelineView>(defaultTimelineView());

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
