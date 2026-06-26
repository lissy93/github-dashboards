<script lang="ts">
	import SortFilterBar from '$lib/components/filter/SortFilterBar.svelte';
	import Feed from '$lib/components/common/Feed.svelte';
	import ActivityItem from '$lib/components/activity/ActivityItem.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { defaultView, type View } from '$lib/components/filter/sort-filter';
	import { activityFilterConfig, activityQuery, activityUrl } from '$lib/views/activity';
	import { COMMUNITY_EXCLUDE, COMMUNITY_TYPES } from '$lib/components/activity/activity-config';
	import { APP_NAME } from '$lib/config';
	import type { ActivityEvent, ActivityPage, ActivityType } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const config = activityFilterConfig();
	let view = $state<View>(defaultView(config));
	let coreOnly = $state(true);
	const query = $derived(activityQuery(view));
	const exclude = $derived(coreOnly ? COMMUNITY_EXCLUDE : '');

	// Core-only hides community types, so selecting one as a filter would show nothing; drop it
	$effect(() => {
		if (coreOnly && COMMUNITY_TYPES.includes(view.filters.type as ActivityType)) coreOnly = false;
	});
	const resetKey = $derived(`${query.type}|${query.q}|${query.dir}|${exclude}`);

	// Fetch one older page of this repo's activity, carrying the current filters
	async function fetchPage(
		cursor: string | null
	): Promise<{ items: ActivityEvent[]; nextCursor: string | null }> {
		const url = activityUrl(data.user, view, cursor, data.repo.name, exclude);
		const response = await fetch(url);
		const body = await response.json();
		if (!response.ok) throw body;
		const page = body as ActivityPage;
		return { items: page.events, nextCursor: page.nextCursor };
	}
</script>

<svelte:head>
	<title>Activity · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

{#await data.result}
	<div class="space-y-3">
		<Skeleton class="h-9 w-full" />
		<div class="bg-card space-y-3 rounded-md border p-4">
			{#each [0, 1, 2, 3, 4, 5] as index (index)}
				<Skeleton class="h-10 w-full" />
			{/each}
		</div>
	</div>
{:then result}
	{#if result.ok}
		<div class="space-y-3">
			<div class="flex flex-wrap items-center gap-2">
				<div class="min-w-0 flex-1">
					<SortFilterBar
						{config}
						bind:view
						showSort={false}
						showDir={false}
						searchPlaceholder="Search activity"
					/>
				</div>
				<label class="flex shrink-0 items-center gap-1.5 text-sm">
					<Switch size="sm" bind:checked={coreOnly} />
					<span class="text-muted-foreground">Core only</span>
				</label>
			</div>
			<div class="bg-card overflow-hidden rounded-md border">
				<Feed
					initial={result.data.events}
					initialCursor={result.data.nextCursor}
					{fetchPage}
					key={(event) => event.id}
					{resetKey}
					empty="No activity found for this repo"
				>
					{#snippet item(event)}
						<ActivityItem {event} showActor showRepo={false} />
					{/snippet}
				</Feed>
			</div>
		</div>
	{:else}
		<ErrorState error={result.error} />
	{/if}
{/await}
