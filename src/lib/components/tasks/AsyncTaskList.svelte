<script lang="ts">
	import { untrack } from 'svelte';
	import TaskListPage from '$lib/components/tasks/TaskListPage.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import FeedSkeleton from '$lib/components/common/FeedSkeleton.svelte';
	import type { LoadResult } from '$lib/types';
	import type { TaskList } from '$lib/types';

	type MaybeList = Promise<LoadResult<TaskList>> | LoadResult<TaskList>;
	type Props = {
		result: MaybeList;
		// Closed history streamed apart from the open list, so the list never waits on it
		closed?: MaybeList;
		kind: 'pr' | 'issue' | 'mixed';
		title: string;
		empty: string;
	};
	let { result, closed, kind, title, empty }: Props = $props();

	// Resolved in place, an await block would remount the list and drop the viewer's filters
	let closedResult = $state(untrack(() => (closed instanceof Promise ? undefined : closed)));
	$effect(() => {
		const current = closed;
		if (!(current instanceof Promise)) {
			closedResult = current;
			return;
		}
		closedResult = undefined;
		let active = true;
		current.then((value) => {
			if (active) closedResult = value;
		});
		return () => (active = false);
	});

	function closedNote(): string | undefined {
		if (!closed || closedResult?.ok) return undefined;
		if (!closedResult) return 'Loading closed history';
		return closedResult.error.pending
			? 'Closed history is taking a while, check back shortly'
			: "Couldn't load closed history";
	}
</script>

{#await result}
	<FeedSkeleton />
{:then res}
	{#if res.ok}
		<TaskListPage
			list={res.data}
			closed={closedResult?.ok ? closedResult.data : null}
			note={closedNote()}
			{kind}
			{title}
			{empty}
		/>
	{:else}
		<ErrorState error={res.error} />
	{/if}
{/await}
