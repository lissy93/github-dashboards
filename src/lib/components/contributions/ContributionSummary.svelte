<script lang="ts">
	import {
		BookMarked,
		Building2,
		CalendarRange,
		CircleDot,
		FileDiff,
		GitMerge
	} from '@lucide/svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import { contributionTotals, visibleContributions } from '$lib/views/contributions';
	import { compactNumber, formatNumber } from '$lib/utils/format';
	import type { View } from '$lib/utils/sort-filter';
	import type { AuthoredContributions, LoadResult } from '$lib/types';

	const TILE_COUNT = 6;
	const GRID = 'sm:grid-cols-3 lg:grid-cols-6';

	type Result = LoadResult<AuthoredContributions>;
	let { result, view }: { result: Promise<Result> | Result; view: View } = $props();

	// Headline totals for whatever the list below is currently showing
	function tiles(data: AuthoredContributions): Tile[] {
		const rows = visibleContributions(data, view);
		if (!rows.length) return [];
		const totals = contributionTotals(rows);
		const span = `${totals.years[0]}–${totals.years.at(-1)}`;
		return [
			{ label: 'Repos', value: formatNumber(totals.repos), icon: BookMarked },
			{ label: 'Owners', value: formatNumber(totals.owners), icon: Building2 },
			{ label: 'Merged PRs', value: compactNumber(totals.prs), icon: GitMerge },
			{ label: 'Issues', value: compactNumber(totals.issues), icon: CircleDot },
			{
				label: 'Lines changed',
				value: compactNumber(totals.additions + totals.deletions),
				icon: FileDiff,
				hint: `${formatNumber(totals.additions)} added, ${formatNumber(totals.deletions)} removed`
			},
			{
				label: 'Years active',
				value: formatNumber(totals.years.length),
				icon: CalendarRange,
				hint: span
			}
		];
	}
</script>

{#await result}
	<StatTileGrid loading={TILE_COUNT} class={GRID} />
{:then res}
	{#if res.ok}
		<StatTileGrid tiles={tiles(res.data)} class={GRID} />
	{/if}
{/await}
