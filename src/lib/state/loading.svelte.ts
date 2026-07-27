import { SvelteSet } from 'svelte/reactivity';

// Live registry of in-flight foreground loads, so the top progress bar reflects real work
const tasks = new SvelteSet<symbol>();

// Register one loading task, returns an idempotent release for a try/finally
export function beginLoading(): () => void {
	const id = Symbol();
	tasks.add(id);
	return () => void tasks.delete(id);
}

export const loading = {
	get active() {
		return tasks.size > 0;
	}
};
