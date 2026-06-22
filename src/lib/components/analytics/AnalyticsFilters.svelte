<script lang="ts">
	import { AreaChart, LineChart } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import Icon from '$lib/components/common/Icon.svelte';
	import { cn } from '$lib/utils';
	import {
		ANALYTICS_METRICS,
		ANALYTICS_WINDOWS,
		ANALYTICS_GRANULARITY,
		type AnalyticsView,
		type MetricKey
	} from '$lib/views/analytics';

	let {
		view = $bindable(),
		repos
	}: { view: AnalyticsView; repos: { value: string; label: string }[] } = $props();

	const windowLabel = $derived(
		ANALYTICS_WINDOWS.find((window) => window.key === view.windowKey)?.label ?? ''
	);
	const grainLabel = $derived(
		ANALYTICS_GRANULARITY.find((grain) => grain.key === view.granularity)?.label ?? ''
	);
	const repoLabel = $derived(repos.find((repo) => repo.value === view.repo)?.label ?? 'All repos');

	// Toggle a metric on the chart, never letting the last one be removed
	function toggleMetric(key: MetricKey) {
		const on = view.metrics.includes(key);
		if (on && view.metrics.length === 1) return;
		view.metrics = on ? view.metrics.filter((item) => item !== key) : [...view.metrics, key];
	}
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-center gap-2">
		<Select.Root type="single" bind:value={view.windowKey}>
			<Select.Trigger class="h-9 w-36">{windowLabel}</Select.Trigger>
			<Select.Content>
				{#each ANALYTICS_WINDOWS as window (window.key)}
					<Select.Item value={window.key}>{window.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Select.Root type="single" bind:value={view.granularity}>
			<Select.Trigger class="h-9 w-28">{grainLabel}</Select.Trigger>
			<Select.Content>
				{#each ANALYTICS_GRANULARITY as grain (grain.key)}
					<Select.Item value={grain.key}>{grain.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		{#if repos.length > 1}
			<Select.Root type="single" bind:value={view.repo}>
				<Select.Trigger class="h-9 w-44">{repoLabel}</Select.Trigger>
				<Select.Content>
					<Select.Item value="">All repos</Select.Item>
					{#each repos as repo (repo.value)}
						<Select.Item value={repo.value}>{repo.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}

		<Button
			variant="outline"
			size="icon"
			class="ml-auto size-9"
			aria-label="Toggle area fill"
			aria-pressed={view.area}
			onclick={() => (view.area = !view.area)}
		>
			<Icon icon={view.area ? AreaChart : LineChart} />
		</Button>
	</div>

	<!-- Metric chips, click to add or drop a series from the chart -->
	<div class="flex flex-wrap gap-1.5">
		{#each ANALYTICS_METRICS as metric (metric.key)}
			{@const on = view.metrics.includes(metric.key)}
			<button
				type="button"
				aria-pressed={on}
				onclick={() => toggleMetric(metric.key)}
				class={cn(
					'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
					on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
				)}
			>
				<span
					class="size-2.5 rounded-sm"
					style="background-color: {metric.color}; opacity: {on ? 1 : 0.4}"
				></span>
				{metric.label}
			</button>
		{/each}
	</div>
</div>
