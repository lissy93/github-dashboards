import { SvelteMap } from 'svelte/reactivity';
import { fetchApi } from '$lib/state/api';
import { usePanelStatus, type PanelStatusStore } from '$lib/state/panel-status.svelte';
import { createLogger } from '$lib/utils/logger';
import type { LoadResult } from '$lib/types';

const log = createLogger('revalidate');
// One revalidation can walk a few GitHub pages server-side, so allow a longer window
const REVALIDATE_TIMEOUT_MS = 60000;

type MaybeResult<T> = Promise<LoadResult<T>> | LoadResult<T>;
type Phase = 'refreshing' | 'fresh' | 'stale';

type Options<T> = {
	url: () => string;
	initial: () => MaybeResult<T>;
	enabled: () => boolean;
};

// Live revalidations across the page, rolled into one freshness row in the status report
const phases = new SvelteMap<symbol, Phase>();

// Summarise every revalidating dataset on the page as a single status entry
function syncFreshness(status: PanelStatusStore | undefined): void {
	if (!status) return;
	const all = [...phases.values()];
	if (!all.length) return status.remove('freshness');
	const refreshing = all.filter((phase) => phase === 'refreshing').length;
	const stale = all.filter((phase) => phase === 'stale').length;
	const entry = refreshing
		? { cause: 'refreshing' as const, detail: `Refreshing ${refreshing} of ${all.length} datasets` }
		: stale
			? {
					cause: 'stale' as const,
					detail: `${stale} of ${all.length} refreshes failed, showing cached data`
				}
			: { cause: 'fresh' as const, detail: `All ${all.length} datasets refreshed on this visit` };
	status.set({ id: 'freshness', title: 'Freshness', ...entry });
}

// Show the SSR cache instantly, then a signed-in viewer refetches once and we swap the
// fresh copy in. The endpoint writes through the shared cache so anonymous viewers ride it
export function revalidatingResult<T>(options: Options<T>) {
	let fresh = $state<LoadResult<T>>();
	const result = $derived(fresh ?? options.initial());
	const status = usePanelStatus();
	const id = Symbol();

	const setPhase = (phase: Phase) => {
		phases.set(id, phase);
		syncFreshness(status);
	};

	$effect(() => {
		const url = options.url();
		const enabled = options.enabled();
		fresh = undefined;
		if (!enabled) return;
		let active = true;
		setPhase('refreshing');
		(async () => {
			try {
				const data = await fetchApi<T>(url, REVALIDATE_TIMEOUT_MS);
				if (!active) return;
				fresh = { ok: true, data };
				setPhase('fresh');
			} catch (error) {
				// Keep the cached copy on failure, a slightly stale panel beats a broken one
				log.warn(`failed to revalidate ${url}`, error);
				if (active) setPhase('stale');
			}
		})();
		return () => {
			active = false;
			phases.delete(id);
			syncFreshness(status);
		};
	});

	return {
		get result() {
			return result;
		},
		// Whether a fresh copy has replaced the initial data
		get refreshed() {
			return fresh !== undefined;
		}
	};
}
