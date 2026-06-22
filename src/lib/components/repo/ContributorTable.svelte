<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar';
	import Sparkline from '$lib/components/charts/Sparkline.svelte';
	import { formatNumber, compactNumber, formatDate, relativeTime } from '$lib/format';
	import type { ContributorRow } from '$lib/server/github/contributors';

	let { contributors }: { contributors: ContributorRow[] } = $props();
</script>

<ul class="divide-y">
	{#each contributors as person, index (person.login)}
		<li class="flex items-center gap-3 py-2">
			<span class="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
				{index + 1}
			</span>
			<Avatar.Root class="size-7 shrink-0 rounded-md border">
				<Avatar.Image src={person.avatarUrl} alt={person.login} />
				<Avatar.Fallback class="rounded-md text-xs">
					{person.login.slice(0, 2).toUpperCase()}
				</Avatar.Fallback>
			</Avatar.Root>
			<div class="min-w-0 grow">
				<a
					href={person.htmlUrl}
					target="_blank"
					rel="noreferrer"
					class="block truncate text-sm font-medium hover:underline"
				>
					{person.login}
				</a>
				{#if person.firstCommit && person.lastCommit}
					<p class="text-muted-foreground truncate text-xs">
						{formatDate(person.firstCommit)} · last {relativeTime(person.lastCommit)}
					</p>
				{/if}
			</div>
			{#if person.spark.length}
				<Sparkline values={person.spark} class="hidden w-24 shrink-0 sm:flex" />
			{/if}
			<div
				class="hidden w-28 shrink-0 text-right text-xs tabular-nums md:block"
				title="{formatNumber(person.additions)} added, {formatNumber(person.deletions)} deleted"
			>
				<span class="text-[color:var(--chart-2)]">+{compactNumber(person.additions)}</span>
				<span class="text-[color:var(--danger)]">−{compactNumber(person.deletions)}</span>
			</div>
			<span
				class="text-muted-foreground w-16 shrink-0 text-right text-sm tabular-nums"
				title="{formatNumber(person.contributions)} commits"
			>
				{compactNumber(person.contributions)}
			</span>
		</li>
	{/each}
</ul>
