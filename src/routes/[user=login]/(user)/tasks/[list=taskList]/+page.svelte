<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import TaskListPage from '$lib/components/tasks/TaskListPage.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
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
			<TaskListPage bucket={data.bucket} list={result.list} />
		{:else}
			<div class="mx-auto max-w-md space-y-3 py-20 text-center">
				<Icon icon={TriangleAlert} size={28} class="text-warning mx-auto" />
				<h2 class="text-lg font-medium capitalize">{result.error.title}</h2>
				<p class="text-muted-foreground text-sm">{result.error.message}</p>
			</div>
		{/if}
	{/await}
</div>
