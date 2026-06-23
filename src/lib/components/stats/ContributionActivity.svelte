<script lang="ts">
	import { CalendarDays, ChevronDown } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import Heatmap from '$lib/components/charts/Heatmap.svelte';
	import { HEATMAP_LEVELS } from '$lib/components/charts/chart';
	import { visibleContributionYears } from '$lib/views/stats';
	import { compactNumber, formatNumber } from '$lib/format';
	import { cn } from '$lib/utils';
	import type { UserContributions } from '$lib/types';

	// Years past this stay collapsed on a single-column screen until expanded
	const PREVIEW_YEARS = 2;

	let { data }: { data: UserContributions } = $props();
	const years = $derived(visibleContributionYears(data.years));
	const preview = $derived(years.slice(0, PREVIEW_YEARS));
	const rest = $derived(years.slice(PREVIEW_YEARS));
	const hasData = $derived(data.total > 0);

	let expanded = $state(false);
</script>

<Panel
	title="Contribution activity"
	icon={CalendarDays}
	empty={!hasData}
	emptyText="No public contributions found"
>
	{#snippet actions()}
		<Hint
			text="{formatNumber(
				data.total
			)} contributions across {data.yearsCovered} of {data.totalYears} years"
			class="text-muted-foreground text-xs"
		>
			{compactNumber(data.total)}
			{data.yearsCovered < data.totalYears ? 'loaded' : 'all time'}
		</Hint>
	{/snippet}
	<div class="flex flex-col gap-4">
		{#each preview as year (year.year)}
			<Heatmap days={year.days} year={year.year} total={year.total} />
		{/each}

		{#if rest.length}
			<!-- Collapsed to a peek on small screens, always open from lg up -->
			<div
				class={cn(
					'grid transition-[grid-template-rows] duration-300 ease-out lg:grid-rows-[1fr]',
					expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
				)}
			>
				<div class="flex min-h-0 flex-col gap-4 overflow-hidden">
					{#each rest as year (year.year)}
						<Heatmap days={year.days} year={year.year} total={year.total} />
					{/each}
				</div>
			</div>

			<button
				type="button"
				class="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 rounded-md py-1 text-xs transition-colors lg:hidden"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				{expanded
					? 'Show less'
					: `Show ${rest.length} more ${rest.length === 1 ? 'year' : 'years'}`}
				<ChevronDown class={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
			</button>
		{/if}

		<div class="text-muted-foreground flex items-center gap-1.5 self-end text-[0.65rem]">
			<span>Less</span>
			{#each HEATMAP_LEVELS as level (level)}
				<span class="size-[11px] rounded-[2px]" style="background-color: {level}"></span>
			{/each}
			<span>More</span>
		</div>
		{#if data.yearsCovered < data.totalYears}
			<p class="text-muted-foreground text-xs">
				Building contribution history, {data.yearsCovered} of {data.totalYears} years loaded
			</p>
		{/if}
	</div>
</Panel>
