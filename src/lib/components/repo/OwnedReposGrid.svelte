<script lang="ts">
	import RepoGrid from '$lib/components/repo/RepoGrid.svelte';
	import StarWindow from '$lib/components/repo/StarWindow.svelte';
	import { repoConfig } from '$lib/views/repos';
	import { STAR_WINDOW_DEFAULT } from '$lib/config';
	import { createRepoExtras } from '$lib/state/repo-extras.svelte';
	import type { Repo } from '$lib/types';

	let {
		user,
		repos,
		canSeeTraffic = false,
		pageSize = 12
	}: { user: string; repos: Repo[]; canSeeTraffic?: boolean; pageSize?: number } = $props();

	let starWindow = $state(STAR_WINDOW_DEFAULT);
	const lazy = createRepoExtras(
		() => user,
		() => repos,
		() => canSeeTraffic,
		() => starWindow
	);
</script>

<div class="space-y-3">
	{#if lazy.hasDeltas}
		<div class="flex items-center justify-end gap-2">
			<span class="text-xs text-muted-foreground">New stars</span>
			<StarWindow bind:window={starWindow} />
		</div>
	{/if}
	<RepoGrid
		{repos}
		config={repoConfig(repos, lazy.traffic)}
		detailed
		{pageSize}
		extras={lazy.extras}
	/>
</div>
