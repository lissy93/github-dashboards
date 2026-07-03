<script lang="ts">
	import { untrack } from 'svelte';
	import SortFilterBar from '$lib/components/filter/SortFilterBar.svelte';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import { applyView, defaultView, type View } from '$lib/components/filter/sort-filter';
	import { taskConfig } from '$lib/views/tasks';
	import type { TaskList } from '$lib/types';

	type Props = {
		list: TaskList;
		kind: 'pr' | 'issue' | 'mixed';
		title: string;
		empty: string;
	};
	let { list, kind, title, empty }: Props = $props();

	const PAGE_SIZE = 25;
	const config = $derived(taskConfig(list.items, kind));

	let view = $state<View>(untrack(() => defaultView(config)));
	let page = $state(1);
	const visible = $derived(applyView(list.items, config, view));
	const totalPages = $derived(Math.max(1, Math.ceil(visible.length / PAGE_SIZE)));
	const shown = $derived(visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
	const viewKey = $derived(
		`${view.search}|${view.sortKey}|${view.dir}|${JSON.stringify(view.filters)}`
	);

	// Back to the first page whenever the sort, filter or search changes
	$effect(() => {
		if (viewKey) page = 1;
	});
</script>

{#if !list.items.length}
	<p class="text-muted-foreground py-16 text-center text-sm">{empty}</p>
{:else}
	<div class="space-y-3">
		<SortFilterBar {config} bind:view searchPlaceholder="Search {title.toLowerCase()}" />
		{#if visible.length}
			<div class="bg-card overflow-hidden rounded-md border">
				<ul class="divide-y">
					{#each shown as item (item.id)}
						<li><ItemRow {item} /></li>
					{/each}
				</ul>
			</div>
			<Pagination bind:page {totalPages} />
		{:else}
			<p class="text-muted-foreground py-10 text-center text-sm">No items match</p>
		{/if}
	</div>
{/if}
