<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import { TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();

	const meta = $derived(TASK_BUCKETS[data.bucket]);
</script>

<PageMeta
	title={`${data.title} · ${data.user}`}
	description={`${data.title} for ${data.user} on ${APP_NAME}`}
/>

<div class="space-y-4">
	<h1 class="text-base font-medium">{data.title}</h1>
	<AsyncTaskList result={data.result} kind={meta.kind} title={meta.title} empty={meta.empty} />
</div>
