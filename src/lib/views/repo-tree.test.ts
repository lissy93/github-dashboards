import { describe, it, expect } from 'vitest';
import { filterTree, sortNodes, allDirPaths } from '$lib/views/repo-tree';
import type { TreeNode } from '$lib/types';

const file = (name: string, size: number): TreeNode => ({
	name,
	path: name,
	type: 'file',
	size
});

const tree: TreeNode[] = [
	{
		name: 'src',
		path: 'src',
		type: 'dir',
		size: 600,
		fileCount: 2,
		children: [
			{ name: 'index.ts', path: 'src/index.ts', type: 'file', size: 200 },
			{ name: 'utils.ts', path: 'src/utils.ts', type: 'file', size: 400 }
		]
	},
	file('README.md', 100)
];

describe('filterTree', () => {
	it('keeps files matching the query and their ancestor directories', () => {
		const result = filterTree(tree, 'index');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('src');
		expect(result[0].children).toHaveLength(1);
		expect(result[0].children?.[0].name).toBe('index.ts');
	});

	it('keeps every child when the directory name itself matches', () => {
		const result = filterTree(tree, 'src');
		expect(result[0].children).toHaveLength(2);
	});

	it('drops branches with no match and is case-insensitive', () => {
		expect(filterTree(tree, 'README')).toHaveLength(1);
		expect(filterTree(tree, 'nope')).toHaveLength(0);
	});

	it('returns the original nodes for a blank query', () => {
		expect(filterTree(tree, '   ')).toBe(tree);
	});
});

describe('sortNodes', () => {
	it('keeps directories first and orders files by size descending', () => {
		const result = sortNodes(tree, 'size');
		expect(result.map((node) => node.name)).toEqual(['src', 'README.md']);
		expect(result[0].children?.map((node) => node.name)).toEqual(['utils.ts', 'index.ts']);
	});

	it('does not mutate the source tree', () => {
		const before = tree[0].children?.map((node) => node.name);
		sortNodes(tree, 'size');
		expect(tree[0].children?.map((node) => node.name)).toEqual(before);
	});
});

describe('allDirPaths', () => {
	it('collects every directory path', () => {
		expect(allDirPaths(tree)).toEqual(['src']);
	});
});
