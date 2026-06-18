<script lang="ts">
	import Panel from '$lib/components/common/Panel.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { TASK_BUCKETS, TASK_COLUMNS } from '$lib/components/tasks/tasks-config';
	import { paths, APP_NAME } from '$lib/config';
	import type { TaskBucket } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Authored lists make no sense for an org account, so drop them there
	function columnBuckets(column: TaskBucket[], isOrg: boolean): TaskBucket[] {
		return column.filter((bucket) => !(isOrg && (bucket === 'myPrs' || bucket === 'myIssues')));
	}
</script>

<svelte:head>
	<title>{data.user} tasks · {APP_NAME}</title>
	<meta name="description" content="Open issues and PRs for {data.user} on {APP_NAME}" />
</svelte:head>

{#await data.result}
	<div class="grid gap-5 lg:grid-cols-2">
		{#each [0, 1] as column (column)}
			<div class="space-y-5">
				{#each [0, 1] as panel (panel)}
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
		{@const { isOrg, buckets } = result.data}
		<div class="grid items-start gap-5 lg:grid-cols-2">
			{#each TASK_COLUMNS as column, index (index)}
				<div class="space-y-5">
					{#each columnBuckets(column, isOrg) as bucket (bucket)}
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
