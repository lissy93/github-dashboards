<script lang="ts">
	import { BookMarked } from '@lucide/svelte';
	import { onMount, untrack } from 'svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import RepoGrid from '$lib/components/repo/RepoGrid.svelte';
	import StarWindow from '$lib/components/repo/StarWindow.svelte';
	import { repoConfig, type RepoTrafficData } from '$lib/views/repos';
	import { paths, STAR_WINDOW_DEFAULT } from '$lib/config';
	import { createLogger } from '$lib/logger';
	import type { Repo, RepoExtras, RepoStats } from '$lib/types';

	let { user, canSeeTraffic, repos }: { user: string; canSeeTraffic: boolean; repos: Repo[] } =
		$props();

	const log = createLogger('overview-repos');

	// Traffic loads after render so it never blocks the list, sort enables once in
	let traffic = $state<RepoTrafficData | undefined>(
		untrack(() =>
			canSeeTraffic ? { pending: true, views: {}, uniques: {}, clones: {} } : undefined
		)
	);
	let contributors = $state<Record<string, number>>({});
	let starBaselines = $state<Record<string, Record<string, number | null>>>({});
	let repoStats = $state<Record<string, RepoStats>>({});
	let starWindow = $state(STAR_WINDOW_DEFAULT);

	// Merge the lazily loaded signals into per-repo extras for the cards
	const extras = $derived.by(() => {
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
	});
	const hasDeltas = $derived(Object.values(extras).some((extra) => extra.starDelta != null));

	async function loadTraffic() {
		if (!canSeeTraffic) return;
		try {
			const response = await fetch(`/api/${user}/traffic`);
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
			const response = await fetch(`/api/${user}/${endpoint}`);
			const body: { repos?: T } = await response.json();
			if (body.repos) apply(body.repos);
		} catch (error) {
			log.warn(`failed to load ${endpoint}`, error);
		}
	}

	onMount(() => {
		loadTraffic();
		loadRepos<Record<string, number>>('contributors', (value) => (contributors = value));
		loadRepos<Record<string, Record<string, number | null>>>(
			'stars',
			(value) => (starBaselines = value)
		);
		loadRepos<Record<string, RepoStats>>('repo-stats', (value) => (repoStats = value));
	});
</script>

<Panel
	title="Repositories"
	icon={BookMarked}
	href={paths.userRepos(user)}
	empty={repos.length === 0}
>
	{#snippet actions()}
		{#if hasDeltas}
			<span class="text-muted-foreground hidden text-xs sm:inline">New stars</span>
			<StarWindow bind:window={starWindow} />
		{/if}
	{/snippet}
	<RepoGrid {repos} config={repoConfig(repos, traffic)} detailed {extras} />
</Panel>
