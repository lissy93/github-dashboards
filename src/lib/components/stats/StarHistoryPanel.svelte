<script lang="ts">
	import { Star } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import StackedAreaChart from '$lib/components/charts/StackedAreaChart.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import SegmentedControl from '$lib/components/common/SegmentedControl.svelte';
	import { loadJson } from '$lib/state/api';
	import { starHistory, starGainStack, type StarBreakdown } from '$lib/views/stats';
	import { restrictedGate } from '$lib/config/status';
	import type { ChartRange } from '$lib/components/charts/brush.svelte';
	import type { DisplayError } from '$lib/utils/errors';

	let { user, loggedIn }: { user: string; loggedIn: boolean } = $props();

	// Star history shows either the cumulative total or new stars gained per month
	type StarView = 'total' | 'new';
	const STAR_VIEWS: { value: StarView; label: string }[] = [
		{ value: 'total', label: 'Total' },
		{ value: 'new', label: 'New' }
	];
	let starView = $state<StarView>('total');

	// undefined while loading, then the reconstructed breakdown (possibly empty)
	let raw = $state<StarBreakdown>();
	let error = $state<DisplayError>();
	let loaded = $state(false);
	const stack = $derived(raw ? starHistory(raw) : null);
	const gate = $derived(raw?.restricted ? restrictedGate('star history', loggedIn) : null);
	// Only nudge about partial coverage when the list is not gated as restricted
	const covering = $derived(!gate && !!raw?.totalRepos && raw.coveredRepos !== raw.totalRepos);
	const drawable = $derived(!!stack && stack.days.length >= 2);

	// Follow the total chart's zoom, so the summary line never outruns what is drawn
	let zoomed = $state<ChartRange | null>(null);
	// The chart drops its own zoom on a view or data change, so drop our copy with it
	const chartKey = $derived(`${starView}|${stack?.days.length ?? 0}`);
	$effect(() => {
		void chartKey;
		zoomed = null;
	});

	// Average stars per day across the shown range, for the summary line
	const perDay = $derived.by(() => {
		if (!stack || !drawable) return null;
		const range = starView === 'total' ? zoomed : null;
		const from = range?.start ?? 0;
		const to = range?.end ?? stack.days.length - 1;
		const span = Math.max(
			1,
			(Date.parse(stack.days[to]) - Date.parse(stack.days[from])) / 86400000
		);
		return (stack.total[to] - stack.total[from]) / span;
	});

	// Reload when client-side navigation changes the viewed user
	$effect(() => {
		const login = user;
		let active = true;
		raw = undefined;
		error = undefined;
		loaded = false;
		loadJson<StarBreakdown>(login, 'star-history').then((result) => {
			if (!active) return;
			loaded = true;
			if (result.ok) raw = result.data;
			else error = result.error;
		});
		return () => (active = false);
	});
</script>

<Panel
	title="Star history"
	icon={Star}
	loading={!loaded}
	{error}
	empty={!!gate || !drawable}
	emptyText={gate ? gate.text : 'Not enough history yet'}
	emptyHint={gate?.hint}
	cause={gate ? gate.cause : covering ? 'partial' : undefined}
	detail={covering
		? `Covers ${raw?.coveredRepos ?? 0} of ${raw?.totalRepos} repos, more build up over visits`
		: undefined}
>
	{#snippet actions()}
		{#if drawable}
			<SegmentedControl
				options={STAR_VIEWS}
				bind:value={starView}
				size="sm"
				label="Star history view"
			/>
		{:else if covering}
			<span class="text-muted-foreground text-xs tabular-nums">
				Building history for {raw?.coveredRepos ?? 0} of {raw?.totalRepos} repos
			</span>
		{/if}
	{/snippet}
	{#if stack}
		<div class="space-y-2">
			{#if starView === 'new'}
				{@const gains = starGainStack(stack)}
				<StackedBarChart
					bars={gains.bars}
					series={gains.series}
					totalUnit="stars"
					height={15}
					maxLabels={12}
					barGap={0.125}
					zoom
				/>
			{:else}
				<StackedAreaChart data={stack} onrange={(range) => (zoomed = range)} />
			{/if}
			{#if perDay !== null}
				<p class="text-muted-foreground text-xs tabular-nums">
					Average {perDay.toFixed(1)} stars per day{covering
						? ` · ${raw?.coveredRepos ?? 0} of ${raw?.totalRepos} repos`
						: ''}
				</p>
			{/if}
		</div>
	{/if}
</Panel>
