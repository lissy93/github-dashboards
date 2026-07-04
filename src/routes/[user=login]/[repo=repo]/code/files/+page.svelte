<script lang="ts">
	import { FolderTree } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import RepoTree from '$lib/components/repo/RepoTree.svelte';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageMeta
	title={`Files · ${data.repo.nameWithOwner}`}
	description={`Browse the file tree of ${data.repo.nameWithOwner}`}
/>

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
