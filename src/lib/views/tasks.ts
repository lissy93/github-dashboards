import type { FilterDef, SortDef, SortFilterConfig } from '$lib/components/filter/sort-filter';
import type { TaskItem } from '$lib/types';

const CHECK_OPTIONS = [
	{ value: 'success', label: 'Passing' },
	{ value: 'failure', label: 'Failing' },
	{ value: 'pending', label: 'Running' }
];

// Sorted, de-duped select options from a list of raw values
function toOptions(values: string[]): { value: string; label: string }[] {
	return [...new Set(values)].sort().map((value) => ({ value, label: value }));
}

// Sort/filter/search config for a task list. Options come from the items present,
// and PR-only controls drop out for issue lists
export function taskConfig(
	items: TaskItem[],
	kind: 'pr' | 'issue' | 'mixed'
): SortFilterConfig<TaskItem> {
	const sorts: SortDef<TaskItem>[] = [
		{ key: 'updated', label: 'Recently updated', value: (item) => item.updatedAt },
		{ key: 'created', label: 'Newest', value: (item) => item.createdAt },
		{ key: 'comments', label: 'Most comments', value: (item) => item.comments },
		{ key: 'title', label: 'Title', value: (item) => item.title.toLowerCase() }
	];
	if (kind !== 'issue')
		sorts.push({
			key: 'diff',
			label: 'Largest diff',
			value: (item) => (item.additions ?? 0) + (item.deletions ?? 0)
		});

	const repoOptions = toOptions(items.map((item) => item.repo));
	const labelOptions = toOptions(items.flatMap((item) => item.labels.map((label) => label.name)));
	const filters: FilterDef<TaskItem>[] = [];
	if (repoOptions.length > 1)
		filters.push({
			key: 'repo',
			label: 'Repos',
			options: repoOptions,
			test: (item, value) => item.repo === value
		});
	if (labelOptions.length)
		filters.push({
			key: 'label',
			label: 'Labels',
			options: labelOptions,
			test: (item, value) => item.labels.some((label) => label.name === value)
		});
	if (kind !== 'issue')
		filters.push({
			key: 'checks',
			label: 'Checks',
			options: CHECK_OPTIONS,
			test: (item, value) => item.checks === value
		});

	return {
		search: (item) =>
			`${item.repo} ${item.title} #${item.number} ${item.author?.login ?? ''} ${item.labels
				.map((label) => label.name)
				.join(' ')}`,
		sorts,
		filters
	};
}
