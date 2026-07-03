<script lang="ts">
	import TaskListPage from '$lib/components/tasks/TaskListPage.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import type { LoadResult } from '$lib/views/overview';
	import type { TaskList } from '$lib/types';

	type Props = {
		result: Promise<LoadResult<TaskList>> | LoadResult<TaskList>;
		kind: 'pr' | 'issue' | 'mixed';
		title: string;
		empty: string;
	};
	let { result, kind, title, empty }: Props = $props();
</script>

{#await result}
	<div class="space-y-3">
		<Skeleton class="h-9 w-full" />
		<div class="bg-card space-y-3 rounded-md border p-4">
			{#each [0, 1, 2, 3, 4, 5] as row (row)}
				<Skeleton class="h-10 w-full" />
			{/each}
		</div>
	</div>
{:then res}
	{#if res.ok}
		<TaskListPage list={res.data} {kind} {title} {empty} />
	{:else}
		<ErrorState error={res.error} />
	{/if}
{/await}
