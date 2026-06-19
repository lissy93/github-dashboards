import { loadOwnedMap } from '$lib/owned-maps';
import type { RepoStats } from '$lib/types';

// Lazily load the heavier per-repo maps a panel ranks or plots by, shared so
// several panels mounting together resolve from one request each. Pass a getter
// so the maps reload when the viewed user changes without a remount
export function ownedMetrics(user: () => string) {
	let stats = $state<Record<string, RepoStats>>();
	let contributors = $state<Record<string, number>>();

	$effect(() => {
		const login = user();
		let active = true;
		stats = undefined;
		contributors = undefined;
		loadOwnedMap<Record<string, RepoStats>>(login, 'repo-stats').then((map) => {
			if (active) stats = map ?? {};
		});
		loadOwnedMap<Record<string, number>>(login, 'contributors').then((map) => {
			if (active) contributors = map ?? {};
		});
		return () => (active = false);
	});

	return {
		get stats() {
			return stats;
		},
		get contributors() {
			return contributors;
		},
		// Both maps in, so lazy metrics never rank or plot on partial data
		get loaded() {
			return stats !== undefined && contributors !== undefined;
		}
	};
}
