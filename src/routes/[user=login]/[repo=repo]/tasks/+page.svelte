<script lang="ts">
	import { CircleDot, GitPullRequest } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import TotalTimelinePanel from '$lib/components/tasks/TotalTimelinePanel.svelte';
	import { paths } from '$lib/config';
	import { progressiveTimeline } from '$lib/state/progressive.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';
	import type { TaskList } from '$lib/types';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();

	const section = (slug: string) => paths.repoTasksSection(data.user, data.repo.name, slug);

	// Signed-in viewers deepen the timeline progressively, the charts fill as older data lands
	const timeline = progressiveTimeline(() => data);
	const tasks = revalidatingResult({
		url: () => `/api/${data.user}/${data.repo.name}/tasks?fresh=1`,
		initial: () => data.tasks,
		enabled: () => !!data.viewerLogin
	});
</script>

<PageMeta
	title={`Tasks · ${data.repo.nameWithOwner}`}
	description={`Issues and pull requests over time for ${data.repo.nameWithOwner}`}
/>

{#snippet openList(items: TaskList['items'])}
	<ul class="-m-4 divide-y">
		{#each items as item (item.id)}
			<li><ItemRow {item} /></li>
		{/each}
	</ul>
{/snippet}

<!-- A column per kind: the running total chart on top, the live open list below -->
<div class="grid items-start gap-5 lg:grid-cols-2">
	<div class="space-y-5">
		<TotalTimelinePanel
			result={timeline.result}
			kind="issue"
			cause={timeline.cause}
			detail={timeline.detail}
		/>

		<AsyncPanel
			title="Open issues"
			icon={CircleDot}
			href={section('issues')}
			result={tasks.result}
			count={(t) => t.issues.total}
			capped={(t) => t.issues.capped}
			empty={(t) => t.issues.items.length === 0}
			emptyText="No open issues"
		>
			{#snippet children(t)}
				{@render openList(t.issues.items)}
			{/snippet}
		</AsyncPanel>
	</div>

	<div class="space-y-5">
		<TotalTimelinePanel
			result={timeline.result}
			kind="pr"
			cause={timeline.cause}
			detail={timeline.detail}
		/>

		<AsyncPanel
			title="Open PRs"
			icon={GitPullRequest}
			href={section('prs')}
			result={tasks.result}
			count={(t) => t.prs.total}
			capped={(t) => t.prs.capped}
			empty={(t) => t.prs.items.length === 0}
			emptyText="No open pull requests"
		>
			{#snippet children(t)}
				{@render openList(t.prs.items)}
			{/snippet}
		</AsyncPanel>
	</div>
</div>
