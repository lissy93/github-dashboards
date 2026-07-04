<script lang="ts">
	import RepoActivityFeed from '$lib/components/repo/RepoActivityFeed.svelte';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageMeta
	title={`Activity · ${data.repo.nameWithOwner}`}
	description={`Commit, release and community activity for ${data.repo.nameWithOwner}`}
/>

<RepoActivityFeed
	user={data.user}
	repo={data.repo.name}
	result={data.result}
	viewerLogin={data.viewerLogin}
/>
