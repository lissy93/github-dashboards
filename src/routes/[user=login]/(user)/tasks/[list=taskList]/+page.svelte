<script lang="ts">
	import TaskListPage from '$lib/components/tasks/TaskListPage.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.title} · {data.user} · {APP_NAME}</title>
	<meta name="description" content="{data.title} for {data.user} on {APP_NAME}" />
</svelte:head>

<div class="space-y-4">
	<h1 class="text-base font-medium">{data.title}</h1>

	{#await data.result}
		<div class="space-y-3">
			<Skeleton class="h-9 w-full" />
			<div class="bg-card space-y-3 rounded-md border p-4">
				{#each [0, 1, 2, 3, 4, 5] as row (row)}
					<Skeleton class="h-10 w-full" />
				{/each}
			</div>
		</div>
	{:then result}
		{#if result.ok}
			<TaskListPage bucket={data.bucket} list={result.data} />
		{:else}
			<ErrorState error={result.error} />
		{/if}
	{/await}
</div>
