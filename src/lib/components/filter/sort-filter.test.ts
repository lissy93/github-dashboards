import { describe, it, expect } from 'vitest';
import { applyView, defaultView, type SortFilterConfig } from '$lib/components/filter/sort-filter';

type Item = { name: string; stars: number; lang: string };

const config: SortFilterConfig<Item> = {
	search: (item) => item.name,
	sorts: [
		{ key: 'stars', label: 'Stars', value: (item) => item.stars },
		{ key: 'name', label: 'Name', value: (item) => item.name }
	],
	filters: [
		{
			key: 'lang',
			label: 'Languages',
			options: [{ value: 'ts', label: 'TS' }],
			test: (item, value) => item.lang === value
		}
	]
};

const items: Item[] = [
	{ name: 'alpha', stars: 5, lang: 'ts' },
	{ name: 'bravo', stars: 30, lang: 'go' },
	{ name: 'charlie', stars: 12, lang: 'ts' }
];

describe('applyView', () => {
	it('sorts descending by the selected key by default', () => {
		const result = applyView(items, config, defaultView(config));
		expect(result.map((item) => item.stars)).toEqual([30, 12, 5]);
	});

	it('respects ascending direction', () => {
		const result = applyView(items, config, { ...defaultView(config), dir: 'asc' });
		expect(result.map((item) => item.stars)).toEqual([5, 12, 30]);
	});

	it('sorts by a different key', () => {
		const view = { ...defaultView(config), sortKey: 'name', dir: 'asc' as const };
		expect(applyView(items, config, view).map((item) => item.name)).toEqual([
			'alpha',
			'bravo',
			'charlie'
		]);
	});

	it('applies an active filter', () => {
		const view = { ...defaultView(config), filters: { lang: 'ts' } };
		expect(applyView(items, config, view).map((item) => item.name)).toEqual(['charlie', 'alpha']);
	});

	it('matches search case-insensitively', () => {
		const view = { ...defaultView(config), search: 'BRA' };
		expect(applyView(items, config, view).map((item) => item.name)).toEqual(['bravo']);
	});

	it('does not mutate the input array', () => {
		const snapshot = items.map((item) => item.name);
		applyView(items, config, defaultView(config));
		expect(items.map((item) => item.name)).toEqual(snapshot);
	});
});
