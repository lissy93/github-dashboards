<script lang="ts">
	import { Clock } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import PunchCard from '$lib/components/charts/PunchCard.svelte';
	import { DAYS_SHORT } from '$lib/utils/datetime';
	import type { RhythmResult } from '$lib/views/overview';
	import type { ActivityRhythm } from '$lib/types';

	let { result }: { result: Promise<RhythmResult> | RhythmResult } = $props();

	const peakLabel = (data: ActivityRhythm) =>
		data.peak
			? `${DAYS_SHORT[data.peak.weekday]} ${String(data.peak.hour).padStart(2, '0')}:00 UTC`
			: null;
</script>

<AsyncPanel
	title="Activity rhythm"
	icon={Clock}
	{result}
	empty={(data) => data.total === 0}
	emptyText="No tracked activity yet"
>
	{#snippet actions(data)}
		{#if peakLabel(data)}
			<span class="text-muted-foreground hidden text-xs sm:inline">Peak {peakLabel(data)}</span>
		{/if}
	{/snippet}
	{#snippet children(data)}
		<div class="flex flex-col gap-4">
			<PunchCard punch={data.punch} peak={data.peak} />
			<p class="text-muted-foreground text-[0.65rem]">
				From tracked activity (commits, PRs, issues, reviews, comments), shown in UTC
			</p>
		</div>
	{/snippet}
</AsyncPanel>
