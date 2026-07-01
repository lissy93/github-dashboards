<script lang="ts">
	import { Activity, FolderTree, GitGraph, Package } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import { supplyChainSummary } from '$lib/views/repo-status';
	import { paths, APP_NAME } from '$lib/config';
	import type { LoadResult } from '$lib/views/overview';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const cards = [
		{
			title: 'Activity',
			icon: Activity,
			section: 'activity',
			text: 'Commits, pushes and contributor activity over time'
		},
		{
			title: 'Files',
			icon: FolderTree,
			section: 'files',
			text: "Browse the repository's file tree and sizes"
		},
		{
			title: 'History',
			icon: GitGraph,
			section: 'git-tree',
			text: 'Interactive commit and branch history graph'
		}
	];

	const supplyChainFallback = 'Dependencies, licences and supply-chain risk';
	const ok = <T,>(result: LoadResult<T>): T | null => (result.ok ? result.data : null);
</script>

<svelte:head>
	<title>Code · {data.repo.nameWithOwner} · {APP_NAME}</title>
	<meta name="description" content="Activity, files and history for {data.repo.nameWithOwner}" />
</svelte:head>

<div class="grid gap-4 sm:grid-cols-2">
	{#each cards as card (card.section)}
		<Panel
			title={card.title}
			icon={card.icon}
			href={paths.repoCodeSection(data.user, data.repo.name, card.section)}
		>
			<p class="text-muted-foreground text-sm">{card.text}</p>
		</Panel>
	{/each}

	<Panel
		title="Supply chain"
		icon={Package}
		href={paths.repoCodeSection(data.user, data.repo.name, 'supply-chain')}
	>
		{#await data.supplyChain}
			<p class="text-muted-foreground text-sm">{supplyChainFallback}</p>
		{:then res}
			{@const sc = ok(res)}
			<p class="text-muted-foreground text-sm">{sc ? supplyChainSummary(sc) : supplyChainFallback}</p>
		{/await}
	</Panel>
</div>
