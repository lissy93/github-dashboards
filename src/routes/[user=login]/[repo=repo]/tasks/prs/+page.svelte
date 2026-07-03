<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Pull requests · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<AsyncTaskList result={data.prs} kind="pr" title="pull requests" empty="No pull requests" />
