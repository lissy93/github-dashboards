import { describe, it, expect } from 'vitest';
import { taskConfig } from '$lib/views/tasks';
import { applyView, defaultView } from '$lib/utils/sort-filter';
import type { TaskItem } from '$lib/types';

const item = (over: Partial<TaskItem>): TaskItem => ({
	id: over.id ?? '1',
	kind: 'pr',
	number: 1,
	title: 'A change',
	url: 'https://github.com/me/a/pull/1',
	repo: 'me/a',
	state: 'open',
	draft: false,
	createdAt: '2024-01-01T00:00:00Z',
	updatedAt: '2024-01-02T00:00:00Z',
	author: { login: 'alice', avatarUrl: '' },
	assignees: [],
	labels: [],
	comments: 0,
	reviewDecision: null,
	checks: null,
	additions: 0,
	deletions: 0,
	changedFiles: 0,
	...over
});

const items = [
	item({ id: 'open', state: 'open' }),
	item({ id: 'merged', state: 'merged', author: { login: 'bob', avatarUrl: '' } }),
	item({ id: 'closed', state: 'closed' })
];

const stateFilter = (kind: 'pr' | 'issue') =>
	taskConfig(items, kind).filters?.find((filter) => filter.key === 'state');

describe('taskConfig', () => {
	it('offers merged only on lists that can hold pull requests', () => {
		expect(stateFilter('pr')?.options.map((option) => option.value)).toEqual([
			'open',
			'merged',
			'closed'
		]);
		expect(stateFilter('issue')?.options.map((option) => option.value)).toEqual(['open', 'closed']);
	});

	it('shows only open work until another state is picked', () => {
		const config = taskConfig(items, 'pr');
		const view = defaultView(config);
		expect(applyView(items, config, view).map((row) => row.id)).toEqual(['open']);
		expect(
			applyView(items, config, { ...view, filters: { ...view.filters, state: 'merged' } }).map(
				(row) => row.id
			)
		).toEqual(['merged']);
		expect(
			applyView(items, config, { ...view, filters: { ...view.filters, state: '' } }).map(
				(row) => row.id
			)
		).toHaveLength(3);
	});

	it('offers an author filter once the list holds more than one', () => {
		const authors = taskConfig(items, 'pr').filters?.find((filter) => filter.key === 'author');
		expect(authors?.options.map((option) => option.value)).toEqual(['alice', 'bob']);
		expect(taskConfig([items[0]], 'pr').filters?.some((filter) => filter.key === 'author')).toBe(
			false
		);
	});
});
