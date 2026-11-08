<script lang="ts">
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import Reactions from '$lib/components/activity/Reactions.svelte';
	import { relativeTime, formatDateTime } from '$lib/utils/format';
	import { GITHUB_WEB, paths } from '$lib/config';
	import {
		activityIcon,
		activityColor,
		activityLabel,
		activitySummary
	} from '$lib/components/activity/activity-config';
	import type { ActivityEvent } from '$lib/types';

	type Props = {
		event: ActivityEvent;
		showActor?: boolean;
		showRepo?: boolean;
	};
	let { event, showActor = false, showRepo = true }: Props = $props();
</script>

<article class="flex gap-3 px-4 py-3">
	<Icon icon={activityIcon(event)} size={16} class="mt-0.5 shrink-0 {activityColor(event)}" />
	<div class="min-w-0 flex-1 space-y-1">
		<div class="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
			<span class="text-foreground">
				{#if showActor && event.actor}<a href={paths.user(event.actor)} class="hover:underline"
						>{event.actor}</a
					>&nbsp;{/if}{activitySummary(event)}
			</span>
			{#if showRepo}
				<a
					href="{GITHUB_WEB}/{event.repo}"
					target="_blank"
					rel="noreferrer"
					class="truncate hover:text-foreground"
				>
					{event.repo}
				</a>
			{/if}
			<span class="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] tracking-wide uppercase">
				{activityLabel(event.type)}
			</span>
			<Hint text={formatDateTime(event.createdAt)} class="ml-auto shrink-0">
				<time datetime={event.createdAt} class="text-xs tabular-nums">
					{relativeTime(event.createdAt)}
				</time>
			</Hint>
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
			<p class="line-clamp-2 text-sm text-muted-foreground">{event.body}</p>
		{/if}
		{#if event.reactions}
			<Reactions {event} />
		{/if}
	</div>
	{#if showActor && event.actor}
		<Hint text={event.actor} class="shrink-0 self-end">
			<a href={paths.user(event.actor)}>
				<UserAvatar
					login={event.actor}
					src="{GITHUB_WEB}/{event.actor}.png?size=40"
					size="sm"
					class="size-5"
					fallbackClass="text-[0.5rem]"
				/>
			</a>
		</Hint>
	{/if}
</article>
