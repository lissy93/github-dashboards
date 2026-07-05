import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { PanelReport } from '$lib/types';

const KEY = Symbol('panel-status');

export type PanelStatusStore = {
	readonly reports: PanelReport[];
	set(report: PanelReport): void;
	remove(id: string): void;
};

// Per-page registry every panel writes its status into, keyed by a stable panel id
export function providePanelStatus(): PanelStatusStore {
	const entries = new SvelteMap<string, PanelReport>();
	const store: PanelStatusStore = {
		get reports() {
			return [...entries.values()];
		},
		set: (report) => void entries.set(report.id, report),
		remove: (id) => void entries.delete(id)
	};
	setContext(KEY, store);
	return store;
}

export function usePanelStatus(): PanelStatusStore | undefined {
	return getContext<PanelStatusStore>(KEY);
}
