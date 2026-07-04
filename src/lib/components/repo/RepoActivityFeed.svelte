<script lang="ts">
	import SortFilterBar from '$lib/components/filter/SortFilterBar.svelte';
	import Feed from '$lib/components/common/Feed.svelte';
	import FeedSkeleton from '$lib/components/common/FeedSkeleton.svelte';
	import ActivityItem from '$lib/components/activity/ActivityItem.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { defaultView, type View } from '$lib/utils/sort-filter';
	import { activityFilterConfig, activityQuery, activityUrl } from '$lib/views/activity';
	import { fetchApi } from '$lib/state/api';
	import { COMMUNITY_EXCLUDE, COMMUNITY_TYPES } from '$lib/config/activity';
	import type { ActivityEvent, ActivityPage, ActivityType } from '$lib/types';
	import type { LoadResult } from '$lib/types';

	// Repo-scoped activity feed with a core-only toggle, reused by the activity tab and the overview.
	// showFilters adds the search/type bar; showToggle the core-only switch; framed wraps the list in
	// its own card (off when nested in a panel); limit renders a static preview of N items instead of
	// the infinite feed (for the compact overview panel); viewerLogin enables a "My activity" toggle
	let {
		user,
		repo,
		result,
		showFilters = true,
		showToggle = true,
		framed = true,
		limit,
		viewerLogin = null
	}: {
		user: string;
		repo: string;
		result: Promise<LoadResult<ActivityPage>> | LoadResult<ActivityPage>;
		showFilters?: boolean;
		showToggle?: boolean;
		framed?: boolean;
		limit?: number;
		viewerLogin?: string | null;
	} = $props();

	const config = activityFilterConfig();
	let view = $state<View>(defaultView(config));
	let coreOnly = $state(true);
	let mine = $state(false);
	const query = $derived(activityQuery(view));
	const exclude = $derived(coreOnly ? COMMUNITY_EXCLUDE : '');

	// Core-only hides community types, so selecting one as a filter would show nothing; drop it
	$effect(() => {
		if (coreOnly && COMMUNITY_TYPES.includes(view.filters.type as ActivityType)) coreOnly = false;
	});
	const resetKey = $derived(`${query.type}|${query.q}|${query.dir}|${exclude}|${mine}`);
	const hasControls = $derived(showFilters || showToggle || !!viewerLogin);

	// Fetch one older page of this repo's activity, carrying the current filters
	async function fetchPage(
		cursor: string | null
	): Promise<{ items: ActivityEvent[]; nextCursor: string | null }> {
		const url = activityUrl(user, view, cursor, repo, exclude, mine);
		const page = await fetchApi<ActivityPage>(url);
		return { items: page.events, nextCursor: page.nextCursor };
	}
</script>

{#await result}
	<FeedSkeleton bar={showFilters} {framed} />
{:then res}
	{#if res.ok}
		<div class="space-y-3">
			{#if hasControls}
				<div class="flex flex-wrap items-center gap-2">
					{#if showFilters}
						<div class="min-w-0 flex-1">
							<SortFilterBar
								{config}
								bind:view
								showSort={false}
								showDir={false}
								searchPlaceholder="Search activity"
							/>
						</div>
					{/if}
					{#if showToggle || viewerLogin}
						<div class="flex shrink-0 items-center gap-3 {showFilters ? '' : 'ml-auto'}">
							{#if viewerLogin}
								<label class="flex items-center gap-1.5 text-sm">
									<Switch size="sm" bind:checked={mine} />
									<span class="text-muted-foreground">My activity</span>
								</label>
							{/if}
							{#if showToggle}
								<label class="flex items-center gap-1.5 text-sm">
									<Switch size="sm" bind:checked={coreOnly} />
									<span class="text-muted-foreground">Core only</span>
								</label>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
			<div
				class={framed
					? 'bg-card overflow-hidden rounded-md border'
					: hasControls
						? '-mx-4 -mb-4 border-t'
						: '-m-4'}
			>
				{#if limit != null}
					{#if res.data.events.length}
						<ul class="divide-y">
							{#each res.data.events.slice(0, limit) as event (event.id)}
								<li><ActivityItem {event} showActor showRepo={false} /></li>
							{/each}
						</ul>
					{:else}
						<p class="text-muted-foreground py-10 text-center text-sm">
							No activity found for this repo
						</p>
					{/if}
				{:else}
					<Feed
						initial={res.data.events}
						initialCursor={res.data.nextCursor}
						{fetchPage}
						key={(event) => event.id}
						{resetKey}
						empty="No activity found for this repo"
					>
						{#snippet item(event)}
							<ActivityItem {event} showActor showRepo={false} />
						{/snippet}
					</Feed>
				{/if}
			</div>
		</div>
	{:else}
		<ErrorState error={res.error} />
	{/if}
{/await}
