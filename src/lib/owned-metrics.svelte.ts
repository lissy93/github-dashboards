import { loadJson } from '$lib/owned-maps';
import type { DisplayError } from '$lib/errors';
import type { OwnedRepoData, RepoStats } from '$lib/types';

// Share the heavier per-repo maps across every stats panel
export function ownedMetrics(user: () => string) {
	let stats = $state<Record<string, RepoStats>>();
	let contributors = $state<Record<string, number>>();
	let statsError = $state<DisplayError>();
	let contributorsError = $state<DisplayError>();
	let statsCoverage = $state<OwnedRepoData<RepoStats>>();
	let contributorCoverage = $state<OwnedRepoData<number>>();
	let statsLoaded = $state(false);

	$effect(() => {
		const login = user();
		let active = true;
		stats = undefined;
		contributors = undefined;
		statsCoverage = undefined;
		contributorCoverage = undefined;
		statsError = undefined;
		contributorsError = undefined;
		statsLoaded = false;
		loadJson<OwnedRepoData<RepoStats>>(login, 'repo-stats').then((result) => {
			if (!active) return;
			statsLoaded = true;
			if (result.ok) {
				statsCoverage = result.data;
				stats = result.data.repos;
			} else statsError = result.error;
		});
		loadJson<OwnedRepoData<number>>(login, 'contributors').then((result) => {
			if (!active) return;
			if (result.ok) {
				contributorCoverage = result.data;
				contributors = result.data.repos;
			} else contributorsError = result.error;
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
		get statsError() {
			return statsError;
		},
		get contributorsError() {
			return contributorsError;
		},
		get statsLoaded() {
			return statsLoaded;
		},
		get statsSampled() {
			return statsCoverage?.sampled ?? false;
		},
		get contributorSampled() {
			return contributorCoverage?.sampled ?? false;
		}
	};
}
