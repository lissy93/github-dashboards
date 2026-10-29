import type { FilterDef, SortDef, SortFilterConfig } from '$lib/utils/sort-filter';
import type { TaskItem, TaskList } from '$lib/types';

const CHECK_OPTIONS = [
	{ value: 'success', label: 'Passing' },
	{ value: 'failure', label: 'Failing' },
	{ value: 'pending', label: 'Running' }
];

const STATE_OPTIONS = [
	{ value: 'open', label: 'Open' },
	{ value: 'merged', label: 'Merged' },
	{ value: 'closed', label: 'Closed' }
];
// Issues never merge, so they get the same list without that state
const ISSUE_STATE_OPTIONS = STATE_OPTIONS.filter((option) => option.value !== 'merged');

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
	const authorOptions = toOptions(items.flatMap((item) => item.author?.login ?? []));
	// Lists carry closed work too, so the default view narrows to what is still open
	const filters: FilterDef<TaskItem>[] = [
		{
			key: 'state',
			label: 'States',
			options: kind === 'issue' ? ISSUE_STATE_OPTIONS : STATE_OPTIONS,
			defaultValue: 'open',
			test: (item, value) => item.state === value
		}
	];
	if (repoOptions.length > 1)
		filters.push({
			key: 'repo',
			label: 'Repos',
			options: repoOptions,
			test: (item, value) => item.repo === value
		});
	if (authorOptions.length > 1)
		filters.push({
			key: 'author',
			label: 'Authors',
			options: authorOptions,
			test: (item, value) => item.author?.login === value
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

// Merge an open and closed list, an item in both (closed since one was cached) keeps its newest copy
export function mergeTaskLists(open: TaskList, closed: TaskList): TaskList {
	const byId = new Map<string, TaskItem>();
	for (const item of [...open.items, ...closed.items])
		if (item.updatedAt >= (byId.get(item.id)?.updatedAt ?? '')) byId.set(item.id, item);
	const duplicates = open.items.length + closed.items.length - byId.size;
	return {
		items: [...byId.values()],
		total: open.total + closed.total - duplicates,
		capped: open.capped || closed.capped
	};
}
