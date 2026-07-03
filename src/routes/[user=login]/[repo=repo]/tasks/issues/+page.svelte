<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Issues · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<AsyncTaskList result={data.issues} kind="issue" title="issues" empty="No issues" />
