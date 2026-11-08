<script lang="ts">
	import { untrack } from 'svelte';
	import SortFilterBar from '$lib/components/filter/SortFilterBar.svelte';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import { applyView, defaultView, type View } from '$lib/utils/sort-filter';
	import { mergeTaskLists, taskConfig } from '$lib/views/tasks';
	import { compactNumber } from '$lib/utils/format';
	import type { TaskList } from '$lib/types';

	type Props = {
		list: TaskList;
		// Closed history that streamed in after the list, merged without resetting the view
		closed?: TaskList | null;
		// Status line for that closed history, e.g. still loading
		note?: string;
		kind: 'pr' | 'issue' | 'mixed';
		title: string;
		empty: string;
	};
	let { list, closed, note, kind, title, empty }: Props = $props();

	const PAGE_SIZE = 25;
	const all = $derived(closed ? mergeTaskLists(list, closed) : list);
	const config = $derived(taskConfig(all.items, kind));

	let view = $state<View>(untrack(() => defaultView(config)));
	let page = $state(1);
	const visible = $derived(applyView(all.items, config, view));
	const totalPages = $derived(Math.max(1, Math.ceil(visible.length / PAGE_SIZE)));
	const shown = $derived(visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
	const viewKey = $derived(
		`${view.search}|${view.sortKey}|${view.dir}|${JSON.stringify(view.filters)}`
	);

	// Fresh view and first page when a different list arrives (route reuse)
	$effect(() => {
		if (list) {
			view = untrack(() => defaultView(config));
			page = 1;
		}
	});

	// Back to the first page whenever the sort, filter or search changes
	$effect(() => {
		if (viewKey) page = 1;
	});
</script>

{#if !all.items.length}
	<p class="py-16 text-center text-sm text-muted-foreground">{empty}</p>
{:else}
	<div class="space-y-3">
		<SortFilterBar {config} bind:view searchPlaceholder="Search {title.toLowerCase()}" />
		{#if note}
			<p class="text-xs text-muted-foreground">{note}</p>
		{/if}
		{#if all.capped}
			<p class="text-xs text-muted-foreground">
				Showing the {compactNumber(all.items.length)} most recent of {compactNumber(all.total)}
				{title}
			</p>
		{/if}
		{#if visible.length}
			<div class="overflow-hidden rounded-md border bg-card">
				<ul class="divide-y">
					{#each shown as item (item.id)}
						<li><ItemRow {item} /></li>
					{/each}
				</ul>
			</div>
			<Pagination bind:page {totalPages} />
		{:else}
			<p class="py-10 text-center text-sm text-muted-foreground">No items match</p>
		{/if}
	</div>
{/if}
