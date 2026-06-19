<script lang="ts">
	import { Building2 } from '@lucide/svelte';
	import SortFilterBar from '$lib/components/filter/SortFilterBar.svelte';
	import Feed from '$lib/components/common/Feed.svelte';
	import ActivityItem from '$lib/components/activity/ActivityItem.svelte';
	import Notice from '$lib/components/common/Notice.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { defaultView, type View } from '$lib/components/filter/sort-filter';
	import { activityFilterConfig, activityQuery, activityUrl } from '$lib/views/activity';
	import { APP_NAME } from '$lib/config';
	import type { ActivityEvent, ActivityPage } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const config = activityFilterConfig();
	let view = $state<View>(defaultView(config));
	const query = $derived(activityQuery(view));
	const resetKey = $derived(`${query.type}|${query.q}|${query.dir}`);

	// Fetch one older page from the API, carrying the current filters
	async function fetchPage(
		cursor: string | null
	): Promise<{ items: ActivityEvent[]; nextCursor: string | null }> {
		const response = await fetch(activityUrl(data.user, view, cursor));
		const body: ActivityPage = await response.json();
		return { items: body.events, nextCursor: body.nextCursor };
	}
</script>

<svelte:head>
	<title>{data.user} activity · {APP_NAME}</title>
	<meta name="description" content="Recent activity from {data.user} on {APP_NAME}" />
</svelte:head>

{#if data.isOrg}
	<Notice
		icon={Building2}
		title="Activity isn't available for organizations"
		message="The activity timeline is built from a user's events feed, which org accounts don't have."
	/>
{:else}
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
				<SortFilterBar
					{config}
					bind:view
					showSort={false}
					showDir={false}
					searchPlaceholder="Search activity"
				/>
				<div class="bg-card overflow-hidden rounded-md border">
					<Feed
						initial={result.data.events}
						initialCursor={result.data.nextCursor}
						{fetchPage}
						key={(event) => event.id}
						{resetKey}
						empty="No activity found"
					>
						{#snippet item(event)}
							<ActivityItem {event} />
						{/snippet}
					</Feed>
				</div>
			</div>
		{:else}
			<ErrorState error={result.error} />
		{/if}
	{/await}
{/if}
