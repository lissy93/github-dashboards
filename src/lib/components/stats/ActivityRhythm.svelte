<script lang="ts">
	import { Clock } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import PunchCard from '$lib/components/charts/PunchCard.svelte';
	import { DAYS_SHORT } from '$lib/datetime';
	import type { ActivityRhythm } from '$lib/types';

	let { data }: { data: ActivityRhythm } = $props();

	const peakLabel = $derived(
		data.peak
			? `${DAYS_SHORT[data.peak.weekday]} ${String(data.peak.hour).padStart(2, '0')}:00 UTC`
			: null
	);
</script>

<Panel
	title="Activity rhythm"
	icon={Clock}
	empty={data.total === 0}
	emptyText="No tracked activity yet"
>
	{#snippet actions()}
		{#if peakLabel}
			<span class="text-muted-foreground hidden text-xs sm:inline">Peak {peakLabel}</span>
		{/if}
	{/snippet}
	<div class="flex flex-col gap-4">
		<PunchCard punch={data.punch} peak={data.peak} />
		<p class="text-muted-foreground text-[0.65rem]">
			From tracked activity (commits, PRs, issues, reviews, comments), shown in UTC
		</p>
	</div>
</Panel>
