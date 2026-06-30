<script lang="ts">
	import RepoActivityFeed from '$lib/components/repo/RepoActivityFeed.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Activity · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<RepoActivityFeed
	user={data.user}
	repo={data.repo.name}
	result={data.result}
	viewerLogin={data.viewerLogin}
/>
