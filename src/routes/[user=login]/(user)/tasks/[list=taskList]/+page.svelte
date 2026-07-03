<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import { TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const meta = $derived(TASK_BUCKETS[data.bucket]);
</script>

<svelte:head>
	<title>{data.title} · {data.user} · {APP_NAME}</title>
	<meta name="description" content="{data.title} for {data.user} on {APP_NAME}" />
</svelte:head>

<div class="space-y-4">
	<h1 class="text-base font-medium">{data.title}</h1>
	<AsyncTaskList result={data.result} kind={meta.kind} title={meta.title} empty={meta.empty} />
</div>
