<script lang="ts">
	import { GitGraph } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import CommitGraph from '$lib/components/repo/CommitGraph.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>History · {data.repo.nameWithOwner} · {APP_NAME}</title>
	<meta name="description" content="Commit history and branches for {data.repo.nameWithOwner}" />
</svelte:head>

<AsyncPanel
	title="History"
	icon={GitGraph}
	result={data.graph}
	empty={(graph) => graph.commits.length === 0}
	emptyText="No commit history yet"
>
	{#snippet children(graph)}
		<CommitGraph {graph} repoUrl={data.repo.url} owner={data.repo.owner} repo={data.repo.name} />
	{/snippet}
</AsyncPanel>
