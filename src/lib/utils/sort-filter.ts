// Config-driven sort/filter/search, shared by every list view

export type SortDef<T> = {
	key: string;
	label: string;
	value: (item: T) => number | string;
	disabled?: boolean;
};
export type FilterDef<T> = {
	key: string;
	label: string;
	options: { value: string; label: string }[];
	test: (item: T, value: string) => boolean;
	defaultValue?: string;
};
export type SortFilterConfig<T> = {
	search?: (item: T) => string;
	sorts: SortDef<T>[];
	filters?: FilterDef<T>[];
};
export type View = {
	search: string;
	sortKey: string;
	dir: 'asc' | 'desc';
	filters: Record<string, string>;
};

export function defaultView<T>(config: SortFilterConfig<T>): View {
	return {
		search: '',
		sortKey: config.sorts[0].key,
		dir: 'desc',
		filters: Object.fromEntries(
			(config.filters ?? []).map((filter) => [filter.key, filter.defaultValue ?? ''])
		)
	};
}

// Filter then sort items for the given view
export function applyView<T>(items: T[], config: SortFilterConfig<T>, view: View): T[] {
	const query = view.search.trim().toLowerCase();
	const sort = config.sorts.find((option) => option.key === view.sortKey) ?? config.sorts[0];
	const direction = view.dir === 'asc' ? 1 : -1;

	const filtered = items.filter((item) => {
		for (const filter of config.filters ?? []) {
			const value = view.filters[filter.key];
			if (value && !filter.test(item, value)) return false;
		}
		if (query && config.search && !config.search(item).toLowerCase().includes(query)) return false;
		return true;
	});

	return filtered.sort((a, b) => {
		const left = sort.value(a);
		const right = sort.value(b);
		if (left < right) return -direction;
		if (left > right) return direction;
		return 0;
	});
}
