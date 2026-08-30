<script lang="ts">
	import Panel from '$lib/components/common/Panel.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import TotalTimelinePanel from '$lib/components/tasks/TotalTimelinePanel.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
	import { TASK_COLUMNS, showsBucket } from '$lib/config/tasks';
	import { navViewer } from '$lib/components/layout/nav';
	import { paths, APP_NAME } from '$lib/config';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { progressiveUserTimeline } from '$lib/state/progressive.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';
	import { TASKS_SUMMARY_PREVIEW } from '$lib/views/overview';

	let { data }: { data: PageData } = $props();

	// The all-time issue/PR totals across their repos, deepening as older history lands
	const timeline = progressiveUserTimeline(() => data);
	const tasks = revalidatingResult({
		url: () => `/api/${data.user}/tasks?fresh=1&preview=${TASKS_SUMMARY_PREVIEW}`,
		initial: () => data.result,
		enabled: () => !!data.viewerLogin
	});

	const isOwner = $derived(navViewer(data.user, data.viewerLogin).isOwner);
	const columns = $derived(
		TASK_COLUMNS.map((column) =>
			column.filter((bucket) => showsBucket(bucket, isOwner, data.isOrg))
		)
	);
</script>

<PageMeta
	title={`${data.user} issues and PRs`}
	description={`Open issues and PRs for ${data.user} on ${APP_NAME}`}
/>

<div class="space-y-5">
	<div class="grid items-start gap-5 lg:grid-cols-2">
		<TotalTimelinePanel
			result={timeline.result}
			kind="pr"
			cause={timeline.cause}
			detail={timeline.detail}
			mini
		/>
		<TotalTimelinePanel
			result={timeline.result}
			kind="issue"
			cause={timeline.cause}
			detail={timeline.detail}
			mini
		/>
	</div>

	{#await tasks.result}
		<div class="grid gap-5 lg:grid-cols-2">
			{#each columns as column, index (index)}
				<div class="space-y-5">
					{#each column as bucket (bucket)}
						<div class="bg-card space-y-3 rounded-md border p-4">
							<Skeleton class="h-5 w-40" />
							{#each [0, 1, 2] as row (row)}
								<Skeleton class="h-10 w-full" />
							{/each}
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{:then result}
		{#if result.ok}
			{@const buckets = result.data.buckets}
			<div class="grid items-start gap-5 lg:grid-cols-2">
				{#each columns as column, index (index)}
					<div class="space-y-5">
						{#each column as bucket (bucket)}
							{@const meta = TASK_BUCKETS[bucket]}
							{@const list = buckets[bucket]}
							<Panel
								title={meta.title}
								icon={meta.icon}
								href={paths.userTaskList(data.user, meta.section)}
								count={list.total}
								capped={list.capped}
								empty={list.items.length === 0}
								emptyText={meta.empty}
							>
								<ul class="-m-4 divide-y">
									{#each list.items as item (item.id)}
										<li><ItemRow {item} /></li>
									{/each}
								</ul>
							</Panel>
						{/each}
					</div>
				{/each}
			</div>
		{:else}
			<ErrorState error={result.error} />
		{/if}
	{/await}
</div>
