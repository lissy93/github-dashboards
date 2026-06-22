<script lang="ts">
	import { BookMarked } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import OwnedReposGrid from '$lib/components/repo/OwnedReposGrid.svelte';
	import RepoCardSkeleton from '$lib/components/repo/RepoCardSkeleton.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Repos · {data.user} · {APP_NAME}</title>
	<meta name="description" content="All repositories owned by {data.user} on {APP_NAME}" />
</svelte:head>

{#await data.result}
	<Panel title="Repositories" icon={BookMarked}>
		<div class="grid gap-3 lg:grid-cols-2 3xl:grid-cols-3">
			{#each [0, 1, 2, 3, 4, 5] as index (index)}
				<RepoCardSkeleton />
			{/each}
		</div>
	</Panel>
{:then result}
	{#if result.ok}
		{@const repos = result.data.ownedRepos}
		<Panel title="Repositories" icon={BookMarked} empty={repos.length === 0}>
			<OwnedReposGrid user={data.user} {repos} canSeeTraffic={data.canSeeTraffic} pageSize={24} />
		</Panel>
	{:else}
		<ErrorState error={result.error} />
	{/if}
{/await}
