<script lang="ts">
	import PrivateNotice from '$lib/components/common/PrivateNotice.svelte';
	import AnalyticsDashboard from '$lib/components/analytics/AnalyticsDashboard.svelte';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageMeta
	title={`Traffic · ${data.repo.nameWithOwner}`}
	description={`Views, clones and referrers for ${data.repo.nameWithOwner}`}
/>

{#if data.canSeeTraffic}
	<AnalyticsDashboard user={data.user} repo={data.repo.name} />
{:else}
	<PrivateNotice
		title="Traffic is private"
		user={data.user}
		subject="traffic for this repo"
		loggedIn={!!data.viewerLogin}
	/>
{/if}
