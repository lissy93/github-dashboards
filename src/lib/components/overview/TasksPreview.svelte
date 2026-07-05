<script lang="ts">
	import Panel from '$lib/components/common/Panel.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import { TASK_BUCKETS } from '$lib/components/tasks/tasks-config';
	import { paths } from '$lib/config';
	import type { TaskBucket } from '$lib/types';
	import type { TaskResult } from '$lib/views/overview';

	let { user, result }: { user: string; result: Promise<TaskResult> | TaskResult } = $props();

	// The two review queues shown on the overview, both valid for users and orgs
	const buckets: TaskBucket[] = ['reviewPrs', 'reviewIssues'];
</script>

<div class="grid items-start gap-5 lg:grid-cols-2">
	{#each buckets as bucket (bucket)}
		{@const meta = TASK_BUCKETS[bucket]}
		{#await result}
			<Panel title={meta.title} icon={meta.icon} loading />
		{:then res}
			{@const list = res.ok ? res.data.buckets[bucket] : undefined}
			<Panel
				title={meta.title}
				icon={meta.icon}
				href={paths.userTaskList(user, meta.section)}
				error={res.ok ? undefined : res.error}
				count={list?.total}
				capped={list?.capped}
				empty={list?.items.length === 0}
				emptyText={meta.empty}
			>
				{#if list}
					<ul class="-m-4 divide-y">
						{#each list.items as item (item.id)}
							<li><ItemRow {item} /></li>
						{/each}
					</ul>
				{/if}
			</Panel>
		{/await}
	{/each}
</div>
