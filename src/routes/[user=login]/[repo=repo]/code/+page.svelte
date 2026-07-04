<script lang="ts">
	import { Activity, FolderTree, GitGraph, Package } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import SummaryPanel from '$lib/components/common/SummaryPanel.svelte';
	import { supplyChainSummary } from '$lib/views/repo-status';
	import { paths } from '$lib/config';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

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
</script>

<PageMeta
	title={`Code · ${data.repo.nameWithOwner}`}
	description={`Activity, files and history for ${data.repo.nameWithOwner}`}
/>

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

	<SummaryPanel
		title="Supply chain"
		icon={Package}
		href={paths.repoCodeSection(data.user, data.repo.name, 'supply-chain')}
		result={data.supplyChain}
		summary={supplyChainSummary}
		fallback="Dependencies, licences and supply-chain risk"
	/>
</div>
