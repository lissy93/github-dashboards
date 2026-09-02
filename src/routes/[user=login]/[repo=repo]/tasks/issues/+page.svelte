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

<div class="space-y-5">
	<TotalTimelinePanel
		result={timeline.result}
		kind="issue"
		cause={timeline.cause}
		detail={timeline.detail}
	/>
	<AsyncTaskList result={issues.result} kind="issue" title="issues" empty="No issues" />
</div>
