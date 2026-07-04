<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageMeta
	title={`Issues · ${data.repo.nameWithOwner}`}
	description={`Open and closed issues for ${data.repo.nameWithOwner}`}
/>

<AsyncTaskList result={data.issues} kind="issue" title="issues" empty="No issues" />
