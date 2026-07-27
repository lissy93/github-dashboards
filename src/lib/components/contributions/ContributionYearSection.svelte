<script lang="ts">
	import ContributionRepoRow from './ContributionRepoRow.svelte';
	import { formatNumber } from '$lib/utils/format';
	import type { ContribYear } from '$lib/views/contributions';

	let { year }: { year: ContribYear } = $props();
	const mergedPrs = $derived(year.summary.mergedPrs);
	const issues = $derived(year.summary.issues);
</script>

<section>
	<header
		class="bg-muted/50 flex items-baseline justify-between gap-2 rounded-md border px-2.5 py-1"
	>
		<h3 class="text-sm font-semibold tabular-nums">{year.year}</h3>
		<p class="text-muted-foreground flex gap-2 text-xs tabular-nums">
			{#if mergedPrs}<span>{formatNumber(mergedPrs)} PR{mergedPrs === 1 ? '' : 's'}</span>{/if}
			{#if issues}<span>{formatNumber(issues)} issue{issues === 1 ? '' : 's'}</span>{/if}
		</p>
	</header>
	<ul class="divide-y px-1">
		{#each year.repos as repo (repo.repo)}
			<ContributionRepoRow item={repo} merged />
		{/each}
	</ul>
</section>
