<script lang="ts">
	import { AreaChart, LineChart, Sigma } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { cn } from '$lib/utils';
	import {
		TIMELINE_METRICS,
		TIMELINE_WINDOWS,
		type TimelineView,
		type TimelineMetricKey
	} from '$lib/views/repo';

	let { view = $bindable() }: { view: TimelineView } = $props();

	const windowLabel = $derived(
		TIMELINE_WINDOWS.find((window) => window.key === view.windowKey)?.label ?? ''
	);

	// Toggle a series on the chart, never letting the last one be removed
	function toggleMetric(key: TimelineMetricKey) {
		const on = view.metrics.includes(key);
		if (on && view.metrics.length === 1) return;
		view.metrics = on ? view.metrics.filter((item) => item !== key) : [...view.metrics, key];
	}
</script>

<!-- Window, metric chips and the chart toggles share one wrapping row to save space -->
<div class="flex flex-wrap items-center gap-2">
	<Select.Root type="single" bind:value={view.windowKey}>
		<Select.Trigger class="h-9 w-36">{windowLabel}</Select.Trigger>
		<Select.Content>
			{#each TIMELINE_WINDOWS as window (window.key)}
				<Select.Item value={window.key}>{window.label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>

	{#each TIMELINE_METRICS as metric (metric.key)}
		{@const on = view.metrics.includes(metric.key)}
		<Hint text={metric.hint}>
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
		</Hint>
	{/each}

	<div class="ml-auto flex items-center gap-2">
		<Hint text={view.cumulative ? 'Showing cumulative totals' : 'Show cumulative totals over time'}>
			<Button
				variant="outline"
				size="icon"
				class="size-9"
				aria-label="Cumulative totals"
				aria-pressed={view.cumulative}
				onclick={() => (view.cumulative = !view.cumulative)}
			>
				<Icon icon={Sigma} class={view.cumulative ? 'text-primary' : ''} />
			</Button>
		</Hint>
		<Hint text={view.area ? 'Show as lines' : 'Fill area under lines'}>
			<Button
				variant="outline"
				size="icon"
				class="size-9"
				aria-label="Toggle area fill"
				aria-pressed={view.area}
				onclick={() => (view.area = !view.area)}
			>
				<Icon icon={view.area ? AreaChart : LineChart} />
			</Button>
		</Hint>
	</div>
</div>
