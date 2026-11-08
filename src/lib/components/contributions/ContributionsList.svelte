<script lang="ts">
	import Pagination from '$lib/components/common/Pagination.svelte';
	import ContributionRepoRow from './ContributionRepoRow.svelte';
	import {
		contributionRows,
		contributionsConfig,
		summarize,
		MERGED_ACTIVITY
	} from '$lib/views/contributions';
	import { applyView, type View } from '$lib/utils/sort-filter';
	import { formatNumber, plural } from '$lib/utils/format';
	import type { AuthoredContributions } from '$lib/types';

	const PAGE_SIZE = 30;

	// view lives on the page, set by the filter bar above the summary and charts
	let { data, view }: { data: AuthoredContributions; view: View } = $props();

	const rows = $derived(contributionRows(data));
	const config = $derived(contributionsConfig(rows));

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

	// Back to the first page when a different dataset arrives, or the view changes
	$effect(() => {
		if (data && viewKey) page = 1;
	});
</script>

<div class="space-y-3">
	{#if visible.length}
		<p class="text-xs text-muted-foreground tabular-nums">{summary}</p>
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
		<p class="py-6 text-center text-sm text-muted-foreground">No contributions match</p>
	{/if}
</div>
