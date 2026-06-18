<script lang="ts">
	import { CalendarDays } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import Heatmap from '$lib/components/charts/Heatmap.svelte';
	import { HEATMAP_LEVELS } from '$lib/components/charts/chart';
	import { visibleContributionYears } from '$lib/views/stats';
	import { compactNumber, formatNumber } from '$lib/format';
	import type { UserContributions } from '$lib/types';

	let { data }: { data: UserContributions } = $props();
	const years = $derived(visibleContributionYears(data.years));
	const hasData = $derived(data.total > 0);
</script>

<Panel
	title="Contribution activity"
	icon={CalendarDays}
	empty={!hasData}
	emptyText="No public contributions found"
>
	{#snippet actions()}
		<span class="text-muted-foreground text-xs" title="{formatNumber(data.total)} contributions">
			{compactNumber(data.total)} all time
		</span>
	{/snippet}
	<div class="flex flex-col gap-4">
		{#each years as year (year.year)}
			<Heatmap days={year.days} year={year.year} total={year.total} />
		{/each}
		<div class="text-muted-foreground flex items-center gap-1.5 self-end text-[0.65rem]">
			<span>Less</span>
			{#each HEATMAP_LEVELS as level (level)}
				<span class="size-[11px] rounded-[2px]" style="background-color: {level}"></span>
			{/each}
			<span>More</span>
		</div>
	</div>
</Panel>
