<script lang="ts">
	import { FolderTree } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import RepoTree from '$lib/components/repo/RepoTree.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Files · {data.repo.nameWithOwner} · {APP_NAME}</title>
	<meta name="description" content="Browse the file tree of {data.repo.nameWithOwner}" />
</svelte:head>

<AsyncPanel
	title="Files"
	icon={FolderTree}
	result={data.tree}
	empty={(tree) => tree.totalFiles === 0}
	emptyText="No files in this repo"
>
	{#snippet children(tree)}
		<RepoTree {tree} repoUrl={data.repo.url} />
	{/snippet}
</AsyncPanel>
