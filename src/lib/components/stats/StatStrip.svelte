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
	import StatTileGrid from '$lib/components/common/StatTileGrid.svelte';
	import type { Tile } from '$lib/components/common/StatTileGrid.svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { repoTotals } from '$lib/views/stats';
	import { compactNumber, formatNumber, formatSize } from '$lib/utils/format';
	import type { ContributionsResult, LanguagesResult, OverviewResult } from '$lib/views/overview';

	// Lines of code are estimated from byte size at this average line length
	const AVG_LINE_LENGTH = 45;

	type Sources = [OverviewResult, ContributionsResult | null, LanguagesResult];
	let { result }: { result: Promise<Sources> | Sources } = $props();

	// Lifetime headline metrics, built only from datasets that loaded
	function tiles([overview, contributions, languages]: Sources): Tile[] {
		if (!overview.ok) return [];
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
	}

	function coverageText([overview]: Sources): string {
		if (!overview.ok) return '';
		const { ownedRepos, profile, ownedReposCapped, contributedReposCapped } = overview.data;
		if (ownedReposCapped) {
			const suffix = contributedReposCapped ? ' and the contributed list is capped' : '';
			return `Repository charts use the first ${formatNumber(ownedRepos.length)} of ${formatNumber(profile.repoCount)} owned repos${suffix}`;
		}
		return contributedReposCapped ? 'The contributed repository list is capped' : '';
	}
</script>

{#await result}
	<Card.Root class="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 lg:grid-cols-7">
		{#each Array.from({ length: 7 }, (_, index) => index) as index (index)}
			<div class="space-y-2">
				<Skeleton class="h-3 w-16" />
				<Skeleton class="h-6 w-12" />
			</div>
		{/each}
	</Card.Root>
{:then sources}
	{#if !sources[0].ok}
		<Panel title="Summary" icon={Activity} error={sources[0].error} />
	{:else}
		{@const rows = tiles(sources)}
		{@const coverage = coverageText(sources)}
		{#if rows.length}
			<div class="space-y-2">
				<StatTileGrid tiles={rows} />
				{#if coverage}
					<p class="px-1 text-xs text-muted-foreground">{coverage}</p>
				{/if}
			</div>
		{/if}
	{/if}
{/await}
