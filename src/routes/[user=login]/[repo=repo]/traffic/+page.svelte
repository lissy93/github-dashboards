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
	<title>Traffic · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

{#if data.canSeeTraffic}
	<AnalyticsDashboard user={data.user} repo={data.repo.name} />
{:else}
	<Notice
		icon={Lock}
		title="Traffic is private"
		message={data.viewerLogin
			? `Only ${data.user} can view traffic for this repo`
			: `Sign in as ${data.user} to view repo traffic`}
	/>
	{#if !data.viewerLogin}
		<div class="-mt-12 flex justify-center">
			<Button href="/auth/github" variant="outline" class="h-10">
				<GithubMark />Login with GitHub
			</Button>
		</div>
	{/if}
{/if}
