import { describe, it, expect } from 'vitest';
import { indexRefs } from '$lib/server/github/repo-commits';

describe('indexRefs', () => {
	it('maps branches to commits and flags the default branch', () => {
		const map = indexRefs(
			[
				{ name: 'main', target: { oid: 'aaa' } },
				{ name: 'feature', target: { oid: 'bbb' } }
			],
			[],
			'main'
		);
		expect(map.aaa).toEqual([{ name: 'main', type: 'branch', isDefault: true }]);
		expect(map.bbb).toEqual([{ name: 'feature', type: 'branch', isDefault: false }]);
	});

	it('resolves annotated tags through their inner commit target', () => {
		const map = indexRefs(
			[],
			[
				{ name: 'v1.0', target: { oid: 'tagobj', target: { oid: 'commit1' } } },
				{ name: 'v0.9', target: { oid: 'commit2', target: null } }
			],
			'main'
		);
		expect(map.commit1).toEqual([{ name: 'v1.0', type: 'tag', isDefault: false }]);
		expect(map.commit2).toEqual([{ name: 'v0.9', type: 'tag', isDefault: false }]);
	});

	it('groups several refs that point at the same commit', () => {
		const map = indexRefs(
			[{ name: 'main', target: { oid: 'aaa' } }],
			[{ name: 'release', target: { oid: 'aaa', target: null } }],
			'main'
		);
		expect(map.aaa).toHaveLength(2);
	});
});
