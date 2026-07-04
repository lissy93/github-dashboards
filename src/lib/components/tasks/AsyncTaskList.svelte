<script lang="ts">
	import TaskListPage from '$lib/components/tasks/TaskListPage.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import FeedSkeleton from '$lib/components/common/FeedSkeleton.svelte';
	import type { LoadResult } from '$lib/types';
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
	<FeedSkeleton />
{:then res}
	{#if res.ok}
		<TaskListPage list={res.data} {kind} {title} {empty} />
	{:else}
		<ErrorState error={res.error} />
	{/if}
{/await}
