<script lang="ts">
	import { Activity, FolderTree, GitGraph } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import { paths, APP_NAME } from '$lib/config';
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
</script>

<svelte:head>
	<title>Code · {data.repo.nameWithOwner} · {APP_NAME}</title>
	<meta name="description" content="Activity, files and history for {data.repo.nameWithOwner}" />
</svelte:head>

<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each cards as card (card.section)}
		<Panel
			title={card.title}
			icon={card.icon}
			href={paths.repoCodeSection(data.user, data.repo.name, card.section)}
		>
			<p class="text-muted-foreground text-sm">{card.text}</p>
		</Panel>
	{/each}
</div>
