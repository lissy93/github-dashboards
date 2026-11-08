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
	import Panel from '$lib/components/common/Panel.svelte';
	import StatTile from '$lib/components/common/StatTile.svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import ExpandableBarList from '$lib/components/charts/ExpandableBarList.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import Hint from '$lib/components/common/Hint.svelte';
	import MetricTimeChart from '$lib/components/analytics/MetricTimeChart.svelte';
	import AnalyticsFilters from '$lib/components/analytics/AnalyticsFilters.svelte';
	import { createAnalytics } from '$lib/state/analytics.svelte';
	import {
		defaultAnalyticsView,
		aggregate,
		fillGaps,
		chartData,
		totals,
		topPaths,
		topReferrers,
		viewsByRepo,
		repoOptions,
		scopeLabel,
		deltaHint,
		SNAPSHOT_RANGE,
		SNAPSHOT_HINT,
		type AnalyticsView,
		type MetricKey
	} from '$lib/views/analytics';
	import { compactNumber } from '$lib/utils/format';
	import { cn } from '$lib/utils';

	let {
		user,
		repo,
		compact = false
	}: { user: string; repo?: string; compact?: boolean } = $props();

	const METRIC_ICONS: Record<MetricKey, Component> = {
		views: Eye,
		uniqueViews: Users,
		returning: Repeat,
		clones: Copy,
		uniqueClones: CopyCheck
	};

	const analytics = createAnalytics(
		() => user,
		() => repo
	);
	let view = $state<AnalyticsView>(defaultAnalyticsView());

	const data = $derived(analytics.data);
	const repos = $derived(data ? repoOptions(data.repos) : []);
	const daily = $derived(data ? fillGaps(data.daily) : []);
	const hasHistory = $derived(daily.length > 0);
	const points = $derived(aggregate(daily, view));
	const chart = $derived(chartData(points, view.metrics));
	const metricTotals = $derived(data ? totals(daily, view) : []);
	const paths = $derived(data ? topPaths(data.paths, view.repo, 200) : []);
	const referrers = $derived(data ? topReferrers(data.referrers, view.repo, 100) : []);
	const byRepo = $derived(viewsByRepo(daily, view, 100));
	const showByRepo = $derived(repos.length > 1 && !view.repo);

	const rangeScope = $derived(scopeLabel(view));
	const snapshotScope = $derived(scopeLabel(view, SNAPSHOT_RANGE));
	const tileHint = $derived(deltaHint(view));

	const metricTiles = $derived(
		metricTotals.map((metric) => ({
			label: metric.label,
			value: compactNumber(metric.value),
			icon: METRIC_ICONS[metric.key],
			delta: metric.delta,
			hint: metric.delta === undefined ? undefined : tileHint
		}))
	);
</script>

{#snippet scope(label: string, hint?: string)}
	<Hint
		text={hint}
		class={cn('text-xs whitespace-nowrap text-muted-foreground', hint && 'cursor-help')}
	>
		{label}
	</Hint>
{/snippet}

{#if analytics.loading}
	<div class="space-y-4">
		{#if !compact}<Skeleton class="h-9 w-full" />{/if}
		<StatTileGrid loading={5} class="sm:grid-cols-3 lg:grid-cols-5" />
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
{:else if compact}
	<!-- Bare tiles and chart, so the caller's own panel provides the frame -->
	<div class="space-y-4">
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
			{#each metricTiles as tile (tile.label)}
				<StatTile {...tile} />
			{/each}
		</div>
		{#if points.length}
			<MetricTimeChart data={chart} area={view.area} label="Traffic over time" />
		{:else}
			<EmptyState icon={ChartArea} text="No data in this range" />
		{/if}
	</div>
{:else}
	<div class="space-y-4">
		<AnalyticsFilters bind:view {repos} />

		<StatTileGrid tiles={metricTiles} class="sm:grid-cols-3 lg:grid-cols-5" />

		<Panel title="Traffic over time" icon={ChartArea}>
			{#snippet actions()}{@render scope(rangeScope)}{/snippet}
			{#if points.length}
				<MetricTimeChart data={chart} area={view.area} label="Traffic over time" />
			{:else}
				<EmptyState icon={ChartArea} text="No data in this range" />
			{/if}
		</Panel>

		<div class="grid gap-4 lg:grid-cols-2">
			<Panel title="Top pages" icon={FileText} empty={!paths.length} emptyText="No page data">
				{#snippet actions()}{@render scope(snapshotScope, SNAPSHOT_HINT)}{/snippet}
				<ExpandableBarList data={paths} valueLabel="Views" />
			</Panel>
			<Panel
				title="Top referrers"
				icon={ExternalLink}
				empty={!referrers.length}
				emptyText="No referrers"
			>
				{#snippet actions()}{@render scope(snapshotScope, SNAPSHOT_HINT)}{/snippet}
				<ExpandableBarList data={referrers} valueLabel="Views" color="var(--chart-2)" />
			</Panel>
		</div>

		{#if showByRepo}
			<Panel title="Views by repo" icon={BookMarked} empty={!byRepo.length} emptyText="No data">
				{#snippet actions()}{@render scope(rangeScope)}{/snippet}
				<ExpandableBarList data={byRepo} valueLabel="Views" colored />
			</Panel>
		{/if}

		{#if data?.capped}
			<p class="px-1 text-xs text-muted-foreground">
				Building analytics across your repos, cached history remains available while syncing
			</p>
		{/if}
	</div>
{/if}
