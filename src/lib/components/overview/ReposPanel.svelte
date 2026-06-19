<script lang="ts">
	import { BookMarked } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import RepoGrid from '$lib/components/repo/RepoGrid.svelte';
	import StarWindow from '$lib/components/repo/StarWindow.svelte';
	import { repoConfig, type RepoTrafficData } from '$lib/views/repos';
	import { paths, STAR_WINDOW_DEFAULT } from '$lib/config';
	import { loadOwnedMap } from '$lib/owned-maps';
	import { createLogger } from '$lib/logger';
	import type { Repo, RepoExtras, RepoStats } from '$lib/types';

	let { user, canSeeTraffic, repos }: { user: string; canSeeTraffic: boolean; repos: Repo[] } =
		$props();

	const log = createLogger('overview-repos');

	// Traffic loads after render so it never blocks the list, sort enables once in
	let traffic = $state<RepoTrafficData>();
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

	async function loadTraffic(login: string, isActive: () => boolean) {
		try {
			const response = await fetch(`/api/${login}/traffic`);
			const body: {
				available: boolean;
				repos: Record<string, { views: number; uniques: number; clones: number }>;
			} = await response.json();
			if (!isActive()) return;
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
			if (!isActive()) return;
			log.warn('failed to load traffic', error);
			traffic = undefined;
		}
	}

	// Load the lazy per-repo signals, resetting and refetching when the user changes
	$effect(() => {
		const login = user;
		let active = true;
		const isActive = () => active;
		traffic = canSeeTraffic ? { pending: true, views: {}, uniques: {}, clones: {} } : undefined;
		contributors = {};
		starBaselines = {};
		repoStats = {};

		// Apply a lazy owned-repos map once it lands, ignoring a miss or a stale user
		function loadInto<T>(endpoint: string, apply: (repos: T) => void) {
			loadOwnedMap<T>(login, endpoint).then((result) => {
				if (!isActive()) return;
				if (result.ok) apply(result.data);
				else log.warn(`failed to load ${endpoint}`, result.error);
			});
		}

		if (canSeeTraffic) loadTraffic(login, isActive);
		loadInto<Record<string, number>>('contributors', (value) => (contributors = value));
		loadInto<Record<string, Record<string, number | null>>>(
			'stars',
			(value) => (starBaselines = value)
		);
		loadInto<Record<string, RepoStats>>('repo-stats', (value) => (repoStats = value));

		return () => (active = false);
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
