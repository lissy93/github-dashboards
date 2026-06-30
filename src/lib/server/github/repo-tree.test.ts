import { describe, it, expect } from 'vitest';
import { buildTree } from '$lib/server/github/repo-tree';

// Recursive git-tree entries as GitHub returns them, blobs carry a size
const entries = [
	{ path: 'README.md', type: 'blob', size: 100 },
	{ path: 'src', type: 'tree' },
	{ path: 'src/index.ts', type: 'blob', size: 300 },
	{ path: 'src/lib', type: 'tree' },
	{ path: 'src/lib/a.ts', type: 'blob', size: 200 },
	{ path: 'src/lib/b.ts', type: 'blob', size: 400 }
];

describe('buildTree', () => {
	it('nests entries and rolls metrics up into directories', () => {
		const { root, totalFiles, totalDirs, totalSize } = buildTree(entries);
		expect(totalFiles).toBe(4);
		expect(totalDirs).toBe(2);
		expect(totalSize).toBe(1000);

		const src = root.find((node) => node.name === 'src');
		expect(src?.type).toBe('dir');
		expect(src?.size).toBe(900);
		expect(src?.fileCount).toBe(3);

		const lib = src?.children?.find((node) => node.name === 'lib');
		expect(lib?.size).toBe(600);
		expect(lib?.fileCount).toBe(2);
	});

	it('sorts directories before files, then by name', () => {
		const names = buildTree(entries).root.map((node) => node.name);
		expect(names).toEqual(['src', 'README.md']);
	});

	it('creates missing ancestor directories from a deep blob path', () => {
		const { root, totalDirs } = buildTree([{ path: 'a/b/c.txt', type: 'blob', size: 5 }]);
		expect(totalDirs).toBe(2);
		const a = root[0];
		expect(a.name).toBe('a');
		expect(a.children?.[0].name).toBe('b');
		expect(a.children?.[0].children?.[0].name).toBe('c.txt');
		expect(a.size).toBe(5);
	});

	it('treats a missing blob size as zero', () => {
		const { totalSize } = buildTree([{ path: 'empty', type: 'blob' }]);
		expect(totalSize).toBe(0);
	});
});
