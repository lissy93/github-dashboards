<script lang="ts">
	import { untrack } from 'svelte';
	import SortFilterBar from '$lib/components/filter/SortFilterBar.svelte';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import ContributionRepoRow from './ContributionRepoRow.svelte';
	import {
		contributionRows,
		contributionsConfig,
		summarize,
		MERGED_ACTIVITY
	} from '$lib/views/contributions';
	import { applyView, defaultView, type View } from '$lib/utils/sort-filter';
	import { formatNumber, plural } from '$lib/utils/format';
	import type { AuthoredContributions } from '$lib/types';

	const PAGE_SIZE = 30;

	let { data }: { data: AuthoredContributions } = $props();

	const rows = $derived(contributionRows(data));
	const config = $derived(contributionsConfig(rows));

	let view = $state<View>(untrack(() => defaultView(config)));
	let page = $state(1);
	const visible = $derived(applyView(rows, config, view));
	const mergedOnly = $derived(view.filters.activity === MERGED_ACTIVITY);

	// Tally of what the filters leave, counting the same PRs the rows below show
	const summary = $derived.by(() => {
		const totals = summarize(visible);
		const prs = mergedOnly ? totals.mergedPrs : totals.prs;
		const parts = [
			`${formatNumber(visible.length)} ${plural(visible.length, 'result')}`,
			`${formatNumber(prs)} ${mergedOnly ? 'merged ' : ''}${plural(prs, 'PR')}`
		];
		if (!mergedOnly) parts.push(`${formatNumber(totals.issues)} ${plural(totals.issues, 'issue')}`);
		return parts.join(' · ');
	});
	const totalPages = $derived(Math.max(1, Math.ceil(visible.length / PAGE_SIZE)));
	const shown = $derived(visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
	const viewKey = $derived(
		`${view.search}|${view.sortKey}|${view.dir}|${JSON.stringify(view.filters)}`
	);

	// Fresh view and first page when a different dataset arrives (route reuse)
	$effect(() => {
		if (data) {
			view = untrack(() => defaultView(config));
			page = 1;
		}
	});
	// Back to the first page whenever the sort, filter or search changes
	$effect(() => {
		if (viewKey) page = 1;
	});
</script>

<div class="space-y-3">
	<SortFilterBar {config} bind:view searchPlaceholder="Search repos" />
	{#if visible.length}
		<p class="text-muted-foreground text-xs tabular-nums">{summary}</p>
		<ul class="divide-y">
			{#each shown as row (row.year + '/' + row.repo)}
				<ContributionRepoRow
					item={row}
					year={row.year}
					merged={mergedOnly}
					showIssues={!mergedOnly}
				/>
			{/each}
		</ul>
		<Pagination bind:page {totalPages} />
	{:else}
		<p class="text-muted-foreground py-6 text-center text-sm">No contributions match</p>
	{/if}
</div>
