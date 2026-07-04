<script lang="ts">
	import PrivateNotice from '$lib/components/common/PrivateNotice.svelte';
	import AnalyticsDashboard from '$lib/components/analytics/AnalyticsDashboard.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageMeta
	title={`${data.user} analytics`}
	description={`Traffic analytics for ${data.user} on ${APP_NAME}`}
/>

{#if data.allowed}
	<AnalyticsDashboard user={data.user} />
{:else}
	<PrivateNotice
		title="Analytics is private"
		user={data.user}
		subject="repo analytics"
		loggedIn={data.loggedIn}
	/>
{/if}
