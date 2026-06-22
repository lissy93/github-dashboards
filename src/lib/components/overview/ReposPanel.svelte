<script lang="ts">
	import { BookMarked } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import RepoGrid from '$lib/components/repo/RepoGrid.svelte';
	import StarWindow from '$lib/components/repo/StarWindow.svelte';
	import { repoConfig } from '$lib/views/repos';
	import { paths, STAR_WINDOW_DEFAULT } from '$lib/config';
	import { createRepoExtras } from '$lib/repo-extras.svelte';
	import type { Repo } from '$lib/types';

	let { user, canSeeTraffic, repos }: { user: string; canSeeTraffic: boolean; repos: Repo[] } =
		$props();

	let starWindow = $state(STAR_WINDOW_DEFAULT);
	const lazy = createRepoExtras(
		() => user,
		() => repos,
		() => canSeeTraffic,
		() => starWindow
	);
</script>

<Panel
	title="Repositories"
	icon={BookMarked}
	href={paths.userRepos(user)}
	empty={repos.length === 0}
>
	{#snippet actions()}
		{#if lazy.hasDeltas}
			<span class="text-muted-foreground hidden text-xs sm:inline">New stars</span>
			<StarWindow bind:window={starWindow} />
		{/if}
	{/snippet}
	<RepoGrid {repos} config={repoConfig(repos, lazy.traffic)} detailed extras={lazy.extras} />
</Panel>
