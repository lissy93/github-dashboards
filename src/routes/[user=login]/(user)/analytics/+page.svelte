<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import Notice from '$lib/components/common/Notice.svelte';
	import { Button } from '$lib/components/ui/button';
	import GithubMark from '$lib/components/common/GithubMark.svelte';
	import AnalyticsDashboard from '$lib/components/analytics/AnalyticsDashboard.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.user} analytics · {APP_NAME}</title>
	<meta name="description" content="Traffic analytics for {data.user} on {APP_NAME}" />
</svelte:head>

{#if data.allowed}
	<AnalyticsDashboard user={data.user} />
{:else}
	<Notice
		icon={Lock}
		title="Analytics is private"
		message={data.loggedIn
			? `Only ${data.user} can view their repo analytics`
			: `Sign in as ${data.user} to view repo analytics`}
	/>
	{#if !data.loggedIn}
		<div class="-mt-12 flex justify-center">
			<Button href="/auth/github" variant="outline" class="h-10"
				><GithubMark />Login with GitHub</Button
			>
		</div>
	{/if}
{/if}
