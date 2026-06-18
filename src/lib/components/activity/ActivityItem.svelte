<script lang="ts">
	import Icon from '$lib/components/common/Icon.svelte';
	import { relativeTime, formatDate } from '$lib/format';
	import { GITHUB_WEB } from '$lib/config';
	import {
		activityIcon,
		activityColor,
		activityLabel,
		activitySummary
	} from '$lib/components/activity/activity-config';
	import type { ActivityEvent } from '$lib/types';

	let { event }: { event: ActivityEvent } = $props();
</script>

<article class="flex gap-3 px-4 py-3">
	<Icon icon={activityIcon(event)} size={16} class="mt-0.5 shrink-0 {activityColor(event)}" />
	<div class="min-w-0 flex-1 space-y-1">
		<div class="text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-sm">
			<span class="text-foreground">{activitySummary(event)}</span>
			<a
				href="{GITHUB_WEB}/{event.repo}"
				target="_blank"
				rel="noreferrer"
				class="hover:text-foreground truncate"
			>
				{event.repo}
			</a>
			<span class="bg-muted rounded px-1.5 py-0.5 text-[0.65rem] tracking-wide uppercase">
				{activityLabel(event.type)}
			</span>
			<time
				datetime={event.createdAt}
				class="ml-auto shrink-0 text-xs tabular-nums"
				title={formatDate(event.createdAt)}
			>
				{relativeTime(event.createdAt)}
			</time>
		</div>

		{#if event.title}
			<a
				href={event.url}
				target="_blank"
				rel="noreferrer"
				class="line-clamp-1 block text-sm font-medium hover:underline"
			>
				{event.title}
			</a>
		{/if}
		{#if event.body}
			<p class="text-muted-foreground line-clamp-2 text-sm">{event.body}</p>
		{/if}
	</div>
</article>
