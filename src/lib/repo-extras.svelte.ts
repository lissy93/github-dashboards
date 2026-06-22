import { loadOwnedMap } from '$lib/owned-maps';
import { createLogger } from '$lib/logger';
import type { Repo, RepoExtras, RepoStats } from '$lib/types';
import type { RepoTrafficData } from '$lib/views/repos';

const log = createLogger('repo-extras');

type TrafficBody = {
	available: boolean;
	repos: Record<string, { views: number; uniques: number; clones: number }>;
};

// Lazily load the per-repo signals the detailed cards reveal, shared by every repo grid.
// Inputs are getters so the fetch keys only off the user and extras recompute on window changes
export function createRepoExtras(
	getUser: () => string,
	getRepos: () => Repo[],
	getCanSeeTraffic: () => boolean,
	getStarWindow: () => number
) {
	let traffic = $state<RepoTrafficData>();
	let contributors = $state<Record<string, number>>({});
	let starBaselines = $state<Record<string, Record<string, number | null>>>({});
	let repoStats = $state<Record<string, RepoStats>>({});

	// Merge the lazily loaded signals into per-repo extras for the cards
	const extras = $derived.by(() => {
		const window = getStarWindow();
		const out: Record<string, RepoExtras> = {};
		for (const repo of getRepos()) {
			const name = repo.nameWithOwner;
			const baseline = starBaselines[name]?.[window];
			out[name] = {
				views: traffic?.views[name],
				uniqueViews: traffic?.uniques[name],
				clones: traffic?.clones[name],
				contributors: contributors[name],
				starDelta: baseline != null ? repo.stars - baseline : null,
				starWindow: window,
				stats: repoStats[name]
			};
		}
		return out;
	});
	const hasDeltas = $derived(Object.values(extras).some((extra) => extra.starDelta != null));

	async function loadTraffic(login: string, isActive: () => boolean) {
		try {
			const response = await fetch(`/api/${login}/traffic`);
			const body = (await response.json()) as TrafficBody;
			if (!isActive()) return;
			const entries = Object.entries(body.repos);
			const pick = (key: 'views' | 'uniques' | 'clones') =>
				Object.fromEntries(entries.map(([repo, value]) => [repo, value[key]]));
			// Drop the traffic data entirely if no repo actually has any
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
		const login = getUser();
		const canSeeTraffic = getCanSeeTraffic();
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

	return {
		get extras() {
			return extras;
		},
		get traffic() {
			return traffic;
		},
		get hasDeltas() {
			return hasDeltas;
		}
	};
}
