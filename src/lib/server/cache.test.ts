import { describe, it, expect } from 'vitest';
import { packValue, unpackValue } from '$lib/server/cache';

const bigTree = {
	root: Array.from({ length: 200 }, (_, index) => ({
		name: `file-${index}.ts`,
		path: `src/deeply/nested/dir/file-${index}.ts`,
		size: index * 137,
		type: 'file'
	}))
};

describe('cache value codec', () => {
	it('round-trips a big value through the packed wrapper', () => {
		const packed = packValue(bigTree) as { __gz?: string };
		expect(typeof packed.__gz).toBe('string');
		// The whole point: the packed form is much smaller than the raw JSON
		expect(packed.__gz!.length).toBeLessThan(JSON.stringify(bigTree).length / 5);
		expect(unpackValue(packed)).toEqual(bigTree);
	});

	it('leaves small values untouched in both directions', () => {
		const small = { items: [1, 2, 3], total: 3 };
		expect(packValue(small)).toBe(small);
		expect(unpackValue(small)).toBe(small);
	});
});
