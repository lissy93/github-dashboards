<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageMeta
	title={`Pull requests · ${data.repo.nameWithOwner}`}
	description={`Open and merged pull requests for ${data.repo.nameWithOwner}`}
/>

<AsyncTaskList result={data.prs} kind="pr" title="pull requests" empty="No pull requests" />
