<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import TotalTimelinePanel from '$lib/components/tasks/TotalTimelinePanel.svelte';
	import { TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import RefreshButton from '$lib/components/common/RefreshButton.svelte';
	import { progressiveUserTimeline } from '$lib/state/progressive.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';

	let { data }: { data: PageData } = $props();

	const meta = $derived(TASK_BUCKETS[data.bucket]);

	// All-time totals for this list's kind across the user's repos
	const timeline = progressiveUserTimeline(() => data);
	// Open and closed halves both freshen on land, so a just-closed item never lingers as open
	const list = (state: 'open' | 'closed', initial: () => PageData['result']) => {
		const api = (mode: string) =>
			`/api/${data.user}/tasks?${mode}=1&bucket=${data.bucket}&state=${state}`;
		return revalidatingResult({
			url: () => api('fresh'),
			refresh: () => api('refresh'),
			initial,
			enabled: () => !!data.viewerLogin
		});
	};
	const open = list('open', () => data.result);
	const closed = list('closed', () => data.closed);
	const parts = [open, closed];
	const refresh = () => Promise.all([timeline.refresh(), ...parts.map((part) => part.refresh())]);
	const refreshing = $derived(timeline.refreshing || parts.some((part) => part.refreshing));
	const refreshFailed = $derived(timeline.refreshFailed || parts.some((part) => part.failed));
</script>

<PageMeta
	title={`${data.title} · ${data.user}`}
	description={`${data.title} for ${data.user} on ${APP_NAME}`}
/>

<div class="space-y-4">
	<h1 class="text-base font-medium">{data.title}</h1>
	<TotalTimelinePanel
		result={timeline.result}
		kind={meta.kind}
		cause={timeline.cause}
		detail={timeline.detail}
	>
		{#snippet actions()}
			{#if data.viewerLogin}
				<RefreshButton
					onclick={refresh}
					busy={refreshing}
					failed={refreshFailed}
					hint="Refresh the chart and list from GitHub now"
				/>
			{/if}
		{/snippet}
	</TotalTimelinePanel>
	<AsyncTaskList
		result={open.result}
		closed={closed.result}
		kind={meta.kind}
		title={meta.title}
		empty={meta.empty}
	/>
</div>
