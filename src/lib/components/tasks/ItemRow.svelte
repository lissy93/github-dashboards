<script lang="ts">
	import { MessageSquare, FileDiff } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Metric from '$lib/components/common/Metric.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { relativeTime, formatDateTime, formatNumber } from '$lib/format';
	import { GITHUB_WEB } from '$lib/config';
	import { itemIcon, itemColor, CHECK_META, REVIEW_META } from '$lib/components/tasks/tasks-config';
	import type { TaskItem } from '$lib/types';

	let { item }: { item: TaskItem } = $props();

	const check = $derived(item.checks ? CHECK_META[item.checks] : null);
	const review = $derived(item.reviewDecision ? REVIEW_META[item.reviewDecision] : null);
	const diff = $derived(
		`+${formatNumber(item.additions ?? 0)} −${formatNumber(item.deletions ?? 0)}`
	);
</script>

<article class="flex items-start gap-3 px-4 py-3">
	<Icon icon={itemIcon(item)} size={16} class="mt-0.5 {itemColor(item)}" />

	<div class="min-w-0 flex-1 space-y-1">
		<a
			href={item.url}
			target="_blank"
			rel="noreferrer"
			class="line-clamp-1 block text-sm font-medium hover:underline"
		>
			{item.title}
		</a>

		<div class="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
			<a
				href="{GITHUB_WEB}/{item.repo}"
				target="_blank"
				rel="noreferrer"
				class="hover:text-foreground"
			>
				{item.repo}
			</a>
			<span class="tabular-nums">#{item.number}</span>
			<Hint text={formatDateTime(item.createdAt)}>
				<time datetime={item.createdAt}>
					opened {relativeTime(item.createdAt)}{item.author ? ` by ${item.author.login}` : ''}
				</time>
			</Hint>
			{#each item.labels.slice(0, 3) as label (label.name)}
				<span class="inline-flex items-center gap-1">
					<span class="size-2 rounded-full" style="background:#{label.color}"></span>
					{label.name}
				</span>
			{/each}
		</div>
	</div>

	<div class="flex shrink-0 items-center gap-2.5 pt-0.5 text-xs">
		{#if review}
			<Metric icon={review.icon} iconClass={review.color} value="" label={review.label} />
		{/if}
		{#if check}
			<Metric icon={check.icon} iconClass={check.color} value="" label={check.label} />
		{/if}
		{#if item.changedFiles}
			<Metric
				icon={FileDiff}
				value={item.changedFiles}
				label="{diff} across {formatNumber(item.changedFiles)} files"
			/>
		{/if}
		{#if item.comments}
			<Metric
				icon={MessageSquare}
				value={item.comments}
				label="{item.comments} comment{item.comments === 1 ? '' : 's'}"
			/>
		{/if}
		{#if item.assignees.length}
			<div class="flex -space-x-1.5">
				{#each item.assignees.slice(0, 3) as person (person.login)}
					<Hint text="Assigned to @{person.login}">
						<img
							src={person.avatarUrl}
							alt={person.login}
							width="20"
							height="20"
							class="border-card size-5 rounded-full border"
							loading="lazy"
						/>
					</Hint>
				{/each}
			</div>
		{/if}
	</div>
</article>
