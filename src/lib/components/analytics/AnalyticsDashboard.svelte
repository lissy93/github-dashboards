<script lang="ts">
	import type { Component } from 'svelte';
	import {
		Eye,
		Users,
		Repeat,
		Copy,
		CopyCheck,
		ChartArea,
		FileText,
		ExternalLink,
		BookMarked
	} from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import Panel from '$lib/components/common/Panel.svelte';
	import StatTile from '$lib/components/common/StatTile.svelte';
	import ExpandableBarList from '$lib/components/charts/ExpandableBarList.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import MetricTimeChart from '$lib/components/analytics/MetricTimeChart.svelte';
	import AnalyticsFilters from '$lib/components/analytics/AnalyticsFilters.svelte';
	import { createAnalytics } from '$lib/analytics.svelte';
	import {
		defaultAnalyticsView,
		aggregate,
		chartData,
		totals,
		topPaths,
		topReferrers,
		viewsByRepo,
		repoOptions,
		type AnalyticsView,
		type MetricKey
	} from '$lib/views/analytics';
	import { compactNumber } from '$lib/format';

	let { user }: { user: string } = $props();

	const METRIC_ICONS: Record<MetricKey, Component> = {
		views: Eye,
		uniqueViews: Users,
		returning: Repeat,
		clones: Copy,
		uniqueClones: CopyCheck
	};

	const analytics = createAnalytics(() => user);
	let view = $state<AnalyticsView>(defaultAnalyticsView());

	const data = $derived(analytics.data);
	const repos = $derived(data ? repoOptions(data.repos) : []);
	const hasHistory = $derived(!!data && data.daily.length > 0);
	const points = $derived(data ? aggregate(data.daily, view) : []);
	const chart = $derived(chartData(points, view.metrics));
	const metricTotals = $derived(data ? totals(data.daily, view) : []);
	const paths = $derived(data ? topPaths(data.paths, view.repo, 200) : []);
	const referrers = $derived(data ? topReferrers(data.referrers, view.repo, 100) : []);
	const byRepo = $derived(data ? viewsByRepo(data.daily, view, 100) : []);
	const showByRepo = $derived(repos.length > 1 && !view.repo);
</script>

{#if analytics.loading}
	<div class="space-y-4">
		<Skeleton class="h-24 w-full" />
		<Skeleton class="h-9 w-full" />
		<Skeleton class="h-72 w-full" />
	</div>
{:else if analytics.error}
	<ErrorState error={analytics.error} />
{:else if !hasHistory}
	<Panel title="Analytics" icon={ChartArea}>
		<EmptyState
			icon={ChartArea}
			text="No traffic yet"
			hint="Visits and clones build up here each time we sync your repos"
		/>
	</Panel>
{:else}
	<div class="space-y-4">
		<Card.Root class="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
			{#each metricTotals as metric (metric.key)}
				<StatTile
					label={metric.label}
					value={compactNumber(metric.value)}
					icon={METRIC_ICONS[metric.key]}
					delta={metric.delta}
				/>
			{/each}
		</Card.Root>

		<AnalyticsFilters bind:view {repos} />

		<Panel title="Traffic over time" icon={ChartArea}>
			{#if points.length}
				<MetricTimeChart data={chart} area={view.area} />
			{:else}
				<EmptyState icon={ChartArea} text="No data in this range" />
			{/if}
		</Panel>

		<div class="grid gap-4 lg:grid-cols-2">
			<Panel title="Top pages" icon={FileText} empty={!paths.length} emptyText="No page data">
				<ExpandableBarList data={paths} valueLabel="Views" />
			</Panel>
			<Panel
				title="Top referrers"
				icon={ExternalLink}
				empty={!referrers.length}
				emptyText="No referrers"
			>
				<ExpandableBarList data={referrers} valueLabel="Views" color="var(--chart-2)" />
			</Panel>
		</div>

		{#if showByRepo}
			<Panel title="Views by repo" icon={BookMarked} empty={!byRepo.length} emptyText="No data">
				<ExpandableBarList data={byRepo} valueLabel="Views" colored />
			</Panel>
		{/if}

		{#if data?.capped}
			<p class="text-muted-foreground px-1 text-xs">
				Showing your busiest repos, some were left out to stay within limits
			</p>
		{/if}
	</div>
{/if}
