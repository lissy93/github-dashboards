<script lang="ts">
	import { Activity } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import ActivityItem from '$lib/components/activity/ActivityItem.svelte';
	import { paths } from '$lib/config';
	import type { ActivityResult } from '$lib/views/overview';

	let { user, result }: { user: string; result: Promise<ActivityResult> | ActivityResult } =
		$props();
</script>

{#await result}
	<Panel title="Activity" icon={Activity} loading />
{:then res}
	{@const events = res.ok ? res.data : []}
	<Panel
		title="Activity"
		icon={Activity}
		href={paths.userActivity(user)}
		error={res.ok ? undefined : res.error}
		empty={res.ok && events.length === 0}
		emptyText="No recent activity"
	>
		{#if res.ok}
			<ul class="-m-4 divide-y">
				{#each events as event (event.id)}
					<li><ActivityItem {event} /></li>
				{/each}
			</ul>
		{/if}
	</Panel>
{/await}
