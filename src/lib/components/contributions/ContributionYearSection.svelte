<script lang="ts">
	import ContributionRepoRow from './ContributionRepoRow.svelte';
	import { formatNumber, plural } from '$lib/utils/format';
	import type { ContribYear } from '$lib/views/contributions';

	// The panel counts landed work only, so no opened-PR or issue totals here
	let { year }: { year: ContribYear } = $props();
	const mergedPrs = $derived(year.summary.mergedPrs);
</script>

<section>
	<header
		class="flex items-baseline justify-between gap-2 rounded-md border bg-muted/50 px-2.5 py-1"
	>
		<h3 class="text-sm font-semibold tabular-nums">{year.year}</h3>
		<p class="text-xs text-muted-foreground tabular-nums">
			{formatNumber(mergedPrs)} merged {plural(mergedPrs, 'PR')}
		</p>
	</header>
	<ul class="divide-y px-1">
		{#each year.repos as repo (repo.repo)}
			<ContributionRepoRow item={repo} merged showIssues={false} />
		{/each}
	</ul>
</section>
