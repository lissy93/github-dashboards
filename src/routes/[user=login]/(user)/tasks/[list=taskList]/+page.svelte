<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import TotalTimelinePanel from '$lib/components/tasks/TotalTimelinePanel.svelte';
	import { TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { progressiveUserTimeline } from '$lib/state/progressive.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';

	let { data }: { data: PageData } = $props();

	const meta = $derived(TASK_BUCKETS[data.bucket]);

	// All-time totals for this list's kind across the user's repos
	const timeline = progressiveUserTimeline(() => data);
	const tasks = revalidatingResult({
		url: () => `/api/${data.user}/tasks?fresh=1&bucket=${data.bucket}`,
		initial: () => data.result,
		enabled: () => !!data.viewerLogin
	});
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
	/>
	<AsyncTaskList result={tasks.result} kind={meta.kind} title={meta.title} empty={meta.empty} />
</div>
