<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';

	let { data }: { data: PageData } = $props();

	const issues = revalidatingResult({
		url: () => `/api/${data.user}/${data.repo.name}/issues?fresh=1`,
		initial: () => data.issues,
		enabled: () => !!data.viewerLogin
	});
</script>

<PageMeta
	title={`Issues · ${data.repo.nameWithOwner}`}
	description={`Open and closed issues for ${data.repo.nameWithOwner}`}
/>

<AsyncTaskList result={issues.result} kind="issue" title="issues" empty="No issues" />
