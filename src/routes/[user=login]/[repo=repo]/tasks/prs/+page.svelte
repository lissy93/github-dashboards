<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';

	let { data }: { data: PageData } = $props();

	const prs = revalidatingResult({
		url: () => `/api/${data.user}/${data.repo.name}/prs?fresh=1`,
		initial: () => data.prs,
		enabled: () => !!data.viewerLogin
	});
</script>

<PageMeta
	title={`Pull requests · ${data.repo.nameWithOwner}`}
	description={`Open and merged pull requests for ${data.repo.nameWithOwner}`}
/>

<AsyncTaskList result={prs.result} kind="pr" title="pull requests" empty="No pull requests" />
