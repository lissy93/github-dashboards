<script lang="ts">
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import LoadMore from '$lib/components/common/LoadMore.svelte';
	import Sparkline from '$lib/components/charts/Sparkline.svelte';
	import { formatNumber, compactNumber, formatDate, relativeTime } from '$lib/utils/format';
	import { paths } from '$lib/config';
	import type { ContributorRow } from '$lib/types';

	const STEP = 25;

	let { contributors }: { contributors: ContributorRow[] } = $props();

	let shown = $state(STEP);
	const rows = $derived(contributors.slice(0, shown));
</script>

<ul class="divide-y">
	{#each rows as person, index (person.login)}
		<li class="flex items-center gap-3 py-2">
			<span class="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
				{index + 1}
			</span>
			<UserAvatar
				login={person.login}
				src={person.avatarUrl}
				class="size-7 shrink-0 rounded-md border"
				fallbackClass="rounded-md text-xs"
			/>
			<div class="min-w-0 grow">
				<a
					href={paths.user(person.login)}
					class="block truncate text-sm font-medium hover:underline"
				>
					{person.login}
				</a>
				{#if person.firstCommit && person.lastCommit}
					<p class="truncate text-xs text-muted-foreground">
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
				class="w-16 shrink-0 text-right text-sm text-muted-foreground tabular-nums"
				title="{formatNumber(person.contributions)} commits"
			>
				{compactNumber(person.contributions)}
			</span>
		</li>
	{/each}
</ul>

<LoadMore total={contributors.length} step={STEP} bind:shown resetKey={contributors} />
