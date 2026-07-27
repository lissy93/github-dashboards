<script lang="ts">
	import { GitPullRequest, CircleDot } from '@lucide/svelte';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { compactNumber, formatNumber } from '$lib/utils/format';
	import { githubAvatar } from '$lib/config';
	import type { AuthoredRepo } from '$lib/types';

	// merged shows only landed PRs, the default in the compact panel
	let {
		item,
		year,
		merged = false
	}: { item: AuthoredRepo; year?: number; merged?: boolean } = $props();
	const owner = $derived(item.repo.slice(0, item.repo.indexOf('/')));
	const prs = $derived(merged ? item.mergedPrs : item.prs);
</script>

<li class="flex items-center gap-3 py-2">
	<UserAvatar
		login={owner}
		src={githubAvatar(owner)}
		size="sm"
		class="shrink-0 rounded-md border"
		fallbackClass="rounded-md text-[0.65rem]"
	/>
	<div class="min-w-0 grow">
		<a href="/{item.repo}" class="block truncate text-sm font-medium hover:underline">
			{item.repo}
		</a>
		<div class="text-muted-foreground flex items-center gap-1.5 text-xs tabular-nums">
			{#if prs}
				<Hint text={merged ? 'Pull requests merged' : 'Pull requests opened'} class="gap-1">
					<GitPullRequest class="size-3.5" />{formatNumber(prs)}
				</Hint>
			{/if}
			{#if item.issues}
				{#if prs}<span aria-hidden="true">·</span>{/if}
				<Hint text="Issues opened" class="gap-1">
					<CircleDot class="size-3.5" />{formatNumber(item.issues)}
				</Hint>
			{/if}
			{#if year !== undefined}
				{#if prs || item.issues}<span aria-hidden="true">·</span>{/if}
				<span>{year}</span>
			{/if}
		</div>
	</div>
	{#if item.additions || item.deletions}
		<div
			class="shrink-0 text-right text-xs tabular-nums"
			title="{formatNumber(item.additions)} added, {formatNumber(item.deletions)} deleted"
		>
			<span class="text-[color:var(--chart-2)]">+{compactNumber(item.additions)}</span>
			<span class="text-[color:var(--danger)]">−{compactNumber(item.deletions)}</span>
		</div>
	{/if}
</li>
