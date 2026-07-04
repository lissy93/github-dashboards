<script lang="ts">
	import { GitGraph } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import CommitGraph from '$lib/components/repo/CommitGraph.svelte';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageMeta
	title={`History · ${data.repo.nameWithOwner}`}
	description={`Commit history and branches for ${data.repo.nameWithOwner}`}
/>

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
