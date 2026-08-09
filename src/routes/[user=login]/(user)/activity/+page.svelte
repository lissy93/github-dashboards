<script lang="ts">
	import { Building2 } from '@lucide/svelte';
	import SortFilterBar from '$lib/components/filter/SortFilterBar.svelte';
	import Feed from '$lib/components/common/Feed.svelte';
	import FeedSkeleton from '$lib/components/common/FeedSkeleton.svelte';
	import ActivityItem from '$lib/components/activity/ActivityItem.svelte';
	import Notice from '$lib/components/common/Notice.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { defaultView, type View } from '$lib/utils/sort-filter';
	import { activityFilterConfig, activityQuery, activityUrl } from '$lib/views/activity';
	import { fetchApi } from '$lib/state/api';
	import { APP_NAME } from '$lib/config';
	import type { ActivityEvent, ActivityPage } from '$lib/types';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();

	const config = activityFilterConfig();
	let view = $state<View>(defaultView(config));
	const query = $derived(activityQuery(view));

	// the loader syncs without blocking, so reload on land to pick up what it stored
	let resynced = $state<string | null>(null);
	$effect(() => {
		if (data.viewerLogin && !data.isOrg && resynced !== data.user) resynced = data.user;
	});
	const resetKey = $derived(`${query.type}|${query.q}|${query.dir}|${resynced}`);

	// Fetch one older page from the API, carrying the current filters
	async function fetchPage(
		cursor: string | null
	): Promise<{ items: ActivityEvent[]; nextCursor: string | null }> {
		const url = activityUrl(data.user, view, cursor, { fresh: !cursor });
		const body = await fetchApi<ActivityPage>(url);
		return { items: body.events, nextCursor: body.nextCursor };
	}
</script>

<PageMeta
	title={`${data.user} activity`}
	description={`Recent activity from ${data.user} on ${APP_NAME}`}
/>

{#if data.isOrg}
	<Notice
		icon={Building2}
		title="Activity isn't available for organizations"
		message="The activity timeline is built from a user's events feed, which org accounts don't have."
	/>
{:else}
	{#await data.result}
		<FeedSkeleton />
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
