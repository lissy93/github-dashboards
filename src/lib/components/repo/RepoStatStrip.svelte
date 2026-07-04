<script lang="ts">
	import { GitCommitHorizontal, Activity, Users, LifeBuoy, Tag } from '@lucide/svelte';
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import { compactNumber } from '$lib/utils/format';
	import type { StatsSummary } from '$lib/views/repo-stats';

	let { summary }: { summary: StatsSummary } = $props();

	// A dash while a source has not resolved yet
	const num = (value: number | null) => (value === null ? '-' : compactNumber(value));

	const tiles = $derived<Tile[]>([
		{
			label: 'Commits',
			value: num(summary.totalCommits),
			icon: GitCommitHorizontal,
			hint: 'Total commits on the default branch'
		},
		{
			label: 'Recent commits',
			value: num(summary.recentCommits),
			icon: Activity,
			delta: summary.commitsDelta ?? undefined,
			hint: 'Commits in the last four weeks, change versus the four before'
		},
		{
			label: 'Contributors',
			value: num(summary.contributors),
			icon: Users,
			hint: 'People who have committed to this repo'
		},
		{
			label: 'Bus factor',
			value: summary.busFactor === null ? '-' : summary.busFactor,
			icon: LifeBuoy,
			hint:
				summary.topContributorShare === null
					? 'Fewest contributors behind half the commits'
					: `Fewest contributors behind half the commits, top author wrote ${summary.topContributorShare}%`
		},
		{
			label: 'Releases',
			value: num(summary.releaseCount),
			icon: Tag,
			hint: 'Published releases'
		}
	]);
</script>

<StatTileGrid {tiles} class="sm:grid-cols-3 lg:grid-cols-5" />
