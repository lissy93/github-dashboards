<script lang="ts">
	import { BookMarked, TriangleAlert } from '@lucide/svelte';
	import ProfileCard from '$lib/components/profile/ProfileCard.svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import RepoGrid from '$lib/components/repo/RepoGrid.svelte';
	import RepoCardSkeleton from '$lib/components/repo/RepoCardSkeleton.svelte';
	import StarWindow from '$lib/components/repo/StarWindow.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { onMount, untrack } from 'svelte';
	import { repoConfig, type RepoTrafficData } from '$lib/views/repos';
	import { APP_NAME, STAR_WINDOW_DEFAULT } from '$lib/config';
	import { createLogger } from '$lib/logger';
	import type { Repo, RepoExtras, RepoStats } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const log = createLogger('overview');

	// Traffic loads after render so it never blocks the list, sort enables once in
	let traffic = $state<RepoTrafficData | undefined>(
		untrack(() =>
			data.canSeeTraffic ? { pending: true, views: {}, uniques: {}, clones: {} } : undefined
		)
	);
	let contributors = $state<Record<string, number>>({});
	let starBaselines = $state<Record<string, Record<string, number | null>>>({});
	let repoStats = $state<Record<string, RepoStats>>({});
	let starWindow = $state(STAR_WINDOW_DEFAULT);

	// Merge the lazily loaded signals into per-repo extras for the owned cards
	function buildExtras(repos: Repo[]): Record<string, RepoExtras> {
		const out: Record<string, RepoExtras> = {};
		for (const repo of repos) {
			const name = repo.nameWithOwner;
			const baseline = starBaselines[name]?.[starWindow];
			out[name] = {
				views: traffic?.views[name],
				uniqueViews: traffic?.uniques[name],
				clones: traffic?.clones[name],
				contributors: contributors[name],
				starDelta: baseline != null ? repo.stars - baseline : null,
				starWindow,
				stats: repoStats[name]
			};
		}
		return out;
	}

	async function loadTraffic() {
		if (!data.canSeeTraffic) return;
		try {
			const response = await fetch(`/api/${data.user}/traffic`);
			const body: {
				available: boolean;
				repos: Record<string, { views: number; uniques: number; clones: number }>;
			} = await response.json();
			const entries = Object.entries(body.repos);
			const pick = (key: 'views' | 'uniques' | 'clones') =>
				Object.fromEntries(entries.map(([repo, value]) => [repo, value[key]]));
			// Drop the sort entirely if no repo actually has traffic data
			traffic =
				body.available && entries.length
					? {
							pending: false,
							views: pick('views'),
							uniques: pick('uniques'),
							clones: pick('clones')
						}
					: undefined;
		} catch (error) {
			log.warn('failed to load traffic', error);
			traffic = undefined;
		}
	}

	// Fetch a lazy endpoint and hand its repos map to the setter, logging failures
	async function loadRepos<T>(endpoint: string, apply: (repos: T) => void) {
		try {
			const response = await fetch(`/api/${data.user}/${endpoint}`);
			const body: { repos?: T } = await response.json();
			if (body.repos) apply(body.repos);
		} catch (error) {
			log.warn(`failed to load ${endpoint}`, error);
		}
	}

	onMount(() => {
		loadTraffic();
		loadRepos<Record<string, number>>('contributors', (repos) => (contributors = repos));
		loadRepos<Record<string, Record<string, number | null>>>(
			'stars',
			(repos) => (starBaselines = repos)
		);
		loadRepos<Record<string, RepoStats>>('repo-stats', (repos) => (repoStats = repos));
	});
</script>

<svelte:head>
	<title>{data.user} · {APP_NAME}</title>
	<meta name="description" content="{data.user} on {APP_NAME}: repos, stats and activity" />
</svelte:head>

{#await data.result}
	<div class="space-y-5">
		<Card.Root class="flex flex-row items-center gap-4 p-4 sm:p-5">
			<Skeleton class="size-16 rounded-md sm:size-20" />
			<div class="space-y-2">
				<Skeleton class="h-5 w-44" />
				<Skeleton class="h-4 w-64" />
				<Skeleton class="h-3 w-52" />
			</div>
		</Card.Root>
		<Panel title="Repositories" icon={BookMarked}>
			<div class="grid gap-3 lg:grid-cols-2 3xl:grid-cols-3">
				{#each [0, 1, 2, 3, 4, 5] as index (index)}
					<RepoCardSkeleton />
				{/each}
			</div>
		</Panel>
	</div>
{:then result}
	{#if result.ok}
		{@const { profile, ownedRepos } = result.data}
		{@const ownedExtras = buildExtras(ownedRepos)}
		{@const hasDeltas = Object.values(ownedExtras).some((extra) => extra.starDelta != null)}
		<div class="space-y-5">
			<ProfileCard {profile} />

			<!-- Contributed to panel removed for now, see alicia-notes/todo.md -->
			<Panel title="Repositories" icon={BookMarked} empty={ownedRepos.length === 0}>
				{#snippet actions()}
					{#if hasDeltas}
						<span class="text-muted-foreground hidden text-xs sm:inline">New stars</span>
						<StarWindow bind:window={starWindow} />
					{/if}
				{/snippet}
				<RepoGrid
					repos={ownedRepos}
					config={repoConfig(ownedRepos, traffic)}
					detailed
					extras={ownedExtras}
				/>
			</Panel>
		</div>
	{:else}
		<div class="mx-auto max-w-md space-y-3 py-20 text-center">
			<Icon icon={TriangleAlert} size={28} class="text-warning mx-auto" />
			<h1 class="text-lg font-medium capitalize">{result.error.title}</h1>
			<p class="text-muted-foreground text-sm">{result.error.message}</p>
		</div>
	{/if}
{/await}
