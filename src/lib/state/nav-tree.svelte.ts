import { getContext, setContext } from 'svelte';
import type { NavItem } from '$lib/components/layout/nav';

const KEY = Symbol('nav-tree');

export type NavTree = {
	label: string;
	backLink?: { label: string; href: string };
	items: NavItem[];
};

export type NavTreeStore = {
	readonly tree: NavTree | undefined;
	set(tree: NavTree): void;
	clear(): void;
};

// Root-level holder the scope layouts feed, so the mobile drawer can render the current tree
export function provideNavTree(): NavTreeStore {
	let current = $state<NavTree>();
	const store: NavTreeStore = {
		get tree() {
			return current;
		},
		set: (tree) => (current = tree),
		clear: () => (current = undefined)
	};
	setContext(KEY, store);
	return store;
}

export function useNavTree(): NavTreeStore | undefined {
	return getContext<NavTreeStore>(KEY);
}
