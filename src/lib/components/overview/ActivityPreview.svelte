<script lang="ts">
	import { Activity } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import ActivityItem from '$lib/components/activity/ActivityItem.svelte';
	import { paths } from '$lib/config';
	import type { ActivityResult } from '$lib/views/overview';

	let { user, result }: { user: string; result: ActivityResult } = $props();
	const events = $derived(result.ok ? result.data : []);
</script>

<Panel
	title="Activity"
	icon={Activity}
	href={paths.userActivity(user)}
	error={result.ok ? undefined : result.error}
	empty={result.ok && events.length === 0}
	emptyText="No recent activity"
>
	{#if result.ok}
		<ul class="-m-4 divide-y">
			{#each events as event (event.id)}
				<li><ActivityItem {event} /></li>
			{/each}
		</ul>
	{/if}
</Panel>
