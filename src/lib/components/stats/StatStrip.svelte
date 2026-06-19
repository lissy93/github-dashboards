<script lang="ts">
	import {
		Activity,
		GitCommitHorizontal,
		GitPullRequest,
		Star,
		BookMarked,
		Code,
		FileCode
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import StatTile from '$lib/components/common/StatTile.svelte';
	import { repoTotals } from '$lib/views/stats';
	import { compactNumber, formatNumber, formatSize } from '$lib/format';
	import type { ContributionsResult, LanguagesResult, OverviewResult } from '$lib/views/overview';

	// Lines of code are estimated from byte size at this average line length
	const AVG_LINE_LENGTH = 45;

	type Tile = { label: string; value: string; icon: Component; hint?: string };
	let {
		overview,
		contributions,
		languages
	}: {
		overview: OverviewResult;
		contributions: ContributionsResult | null;
		languages: LanguagesResult | null;
	} = $props();

	// Lifetime headline metrics, built only from datasets that loaded
	const tiles = $derived.by(() => {
		if (!overview.ok) return [] as Tile[];
		const { ownedRepos, contributedRepos, ownedReposCapped, contributedReposCapped } =
			overview.data;
		const repos = repoTotals(ownedRepos);
		const capped = ownedReposCapped || contributedReposCapped;
		const out: Tile[] = [];

		if (contributions?.ok) {
			const { total, totals } = contributions.data;
			out.push({ label: 'Contributions', value: compactNumber(total), icon: Activity });
			out.push({
				label: 'Commits',
				value: compactNumber(totals.commits),
				icon: GitCommitHorizontal
			});
			out.push({ label: 'Pull requests', value: compactNumber(totals.prs), icon: GitPullRequest });
		}

		out.push({
			label: 'Stars',
			value: `${compactNumber(repos.stars)}${ownedReposCapped ? '+' : ''}`,
			icon: Star,
			hint: ownedReposCapped ? 'At least this many across the loaded repos' : undefined
		});
		// Own repos plus those contributed to, the full footprint in one tile
		out.push({
			label: 'Repos',
			value: `${compactNumber(repos.repos + contributedRepos.length)}${capped ? '+' : ''}`,
			icon: BookMarked,
			hint: `${capped ? 'At least ' : ''}${formatNumber(repos.repos)} owned + ${formatNumber(contributedRepos.length)} contributed to`
		});

		if (languages?.ok && languages.data.length) {
			const bytes = languages.data.reduce((sum, language) => sum + language.bytes, 0);
			out.push({ label: 'Languages', value: compactNumber(languages.data.length), icon: Code });
			out.push({
				label: 'Lines of code',
				value: compactNumber(Math.round(bytes / AVG_LINE_LENGTH)),
				icon: FileCode,
				hint: `Rough estimate from ${formatSize(bytes / 1024)} of code`
			});
		}
		return out;
	});

	const coverageText = $derived.by(() => {
		if (!overview.ok) return '';
		const { ownedRepos, profile, ownedReposCapped, contributedReposCapped } = overview.data;
		if (ownedReposCapped) {
			const suffix = contributedReposCapped ? ' and the contributed list is capped' : '';
			return `Repository charts use the first ${formatNumber(ownedRepos.length)} of ${formatNumber(profile.repoCount)} owned repos${suffix}`;
		}
		return contributedReposCapped ? 'The contributed repository list is capped' : '';
	});
</script>

{#if tiles.length}
	<div class="space-y-2">
		<Card.Root class="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 lg:grid-cols-7">
			{#each tiles as tile (tile.label)}
				<StatTile label={tile.label} value={tile.value} icon={tile.icon} hint={tile.hint} />
			{/each}
		</Card.Root>
		{#if coverageText}
			<p class="text-muted-foreground px-1 text-xs">{coverageText}</p>
		{/if}
	</div>
{/if}
