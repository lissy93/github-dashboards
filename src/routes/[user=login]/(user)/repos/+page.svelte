<script lang="ts">
	import { BookMarked } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import OwnedReposGrid from '$lib/components/repo/OwnedReposGrid.svelte';
	import RepoCardSkeleton from '$lib/components/repo/RepoCardSkeleton.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';

	let { data }: { data: PageData } = $props();

	const repos = revalidatingResult({
		url: () => `/api/${data.user}/overview?fresh=1`,
		initial: () => data.result,
		enabled: () => !!data.viewerLogin
	});
</script>

<PageMeta
	title={`Repos · ${data.user}`}
	description={`All repositories owned by ${data.user} on ${APP_NAME}`}
/>

{#await repos.result}
	<Panel title="Repositories" icon={BookMarked} cause="loading">
		<div class="3xl:grid-cols-3 grid gap-3 lg:grid-cols-2">
			{#each [0, 1, 2, 3, 4, 5] as index (index)}
				<RepoCardSkeleton />
			{/each}
		</div>
	</Panel>
{:then result}
	{#if result.ok}
		{@const repos = result.data.ownedRepos}
		<Panel
			title="Repositories"
			icon={BookMarked}
			capped={result.data.ownedReposCapped}
			empty={repos.length === 0}
		>
			<OwnedReposGrid user={data.user} {repos} canSeeTraffic={data.canSeeTraffic} pageSize={24} />
		</Panel>
	{:else}
		<ErrorState error={result.error} />
	{/if}
{/await}
