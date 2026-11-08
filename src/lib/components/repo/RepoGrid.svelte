<script lang="ts">
	import { untrack } from 'svelte';
	import RepoCard from '$lib/components/repo/RepoCard.svelte';
	import SortFilterBar from '$lib/components/filter/SortFilterBar.svelte';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import { applyView, defaultView, type SortFilterConfig, type View } from '$lib/utils/sort-filter';
	import { cn } from '$lib/utils';
	import type { Repo, RepoExtras } from '$lib/types';

	let {
		repos,
		config,
		dense = false,
		pageSize = 12,
		detailed = false,
		extras
	}: {
		repos: Repo[];
		config: SortFilterConfig<Repo>;
		dense?: boolean;
		pageSize?: number;
		detailed?: boolean;
		extras?: Record<string, RepoExtras>;
	} = $props();

	let view = $state<View>(untrack(() => defaultView(config)));
	const visible = $derived(applyView(repos, config, view));

	let page = $state(1);
	const totalPages = $derived(Math.max(1, Math.ceil(visible.length / pageSize)));
	const shown = $derived(visible.slice((page - 1) * pageSize, page * pageSize));
	const viewKey = $derived(
		`${view.search}|${view.sortKey}|${view.dir}|${JSON.stringify(view.filters)}`
	);

	// Fresh view and first page when a different repo list arrives (route reuse)
	$effect(() => {
		if (repos) {
			view = untrack(() => defaultView(config));
			page = 1;
		}
	});

	// Return to the first page whenever the sort, filter or search changes
	$effect(() => {
		if (viewKey) page = 1;
	});
</script>

<div class="space-y-3">
	<SortFilterBar {config} bind:view searchPlaceholder="Search repos" />
	{#if visible.length}
		<div class={cn('grid gap-3', !dense && '3xl:grid-cols-3 lg:grid-cols-2')}>
			{#each shown as repo (repo.nameWithOwner)}
				<RepoCard {repo} {detailed} extras={extras?.[repo.nameWithOwner]} />
			{/each}
		</div>
		<Pagination bind:page {totalPages} />
	{:else}
		<p class="py-6 text-center text-sm text-muted-foreground">No repos match</p>
	{/if}
</div>
