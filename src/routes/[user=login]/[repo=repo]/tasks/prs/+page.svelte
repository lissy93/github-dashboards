<script lang="ts">
	import AsyncTaskList from '$lib/components/tasks/AsyncTaskList.svelte';
	import TotalTimelinePanel from '$lib/components/tasks/TotalTimelinePanel.svelte';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { progressiveTimeline } from '$lib/state/progressive.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';

	let { data }: { data: PageData } = $props();

	// All-time totals for this kind, deepened progressively for a signed-in viewer
	const timeline = progressiveTimeline(() => data);
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

<div class="space-y-5">
	<TotalTimelinePanel
		result={timeline.result}
		kind="pr"
		cause={timeline.cause}
		detail={timeline.detail}
	/>
	<AsyncTaskList result={prs.result} kind="pr" title="pull requests" empty="No pull requests" />
</div>
