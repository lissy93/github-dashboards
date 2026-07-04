import { describe, it, expect } from 'vitest';
import { computeGraph, mergeCommits } from '$lib/views/commit-graph';
import type { GraphCommit } from '$lib/types';

// Minimal commit, only oid and parents drive the layout
const commit = (oid: string, parents: string[], date = oid): GraphCommit => ({
	oid,
	short: oid,
	message: oid,
	date,
	author: null,
	login: null,
	parents,
	refs: [],
	pr: null
});

describe('mergeCommits', () => {
	it('appends an older page and drops duplicate oids', () => {
		const existing = [commit('a', ['b'], '2024-03-03'), commit('b', ['c'], '2024-03-02')];
		const incoming = [commit('b', ['c'], '2024-03-02'), commit('c', [], '2024-03-01')];
		const merged = mergeCommits(existing, incoming);
		expect(merged.map((entry) => entry.oid)).toEqual(['a', 'b', 'c']);
	});

	it('keeps the API order even when commit dates interleave', () => {
		// b was committed after a but git history still walks a first, keep it that way
		const existing = [commit('a', ['b'], '2024-03-01')];
		const incoming = [commit('b', [], '2024-03-05')];
		const merged = mergeCommits(existing, incoming);
		expect(merged.map((entry) => entry.oid)).toEqual(['a', 'b']);
	});
});

describe('computeGraph', () => {
	it('keeps a linear history in a single column', () => {
		const { rows, laneCount } = computeGraph([
			commit('a', ['b']),
			commit('b', ['c']),
			commit('c', [])
		]);
		expect(laneCount).toBe(1);
		expect(rows.map((row) => row.col)).toEqual([0, 0, 0]);
		// every node continues straight down to its parent, except the root
		expect(rows[0].bottom).toEqual([{ from: 0, to: 0, color: expect.any(String) }]);
		expect(rows[2].bottom).toEqual([]);
	});

	it('opens a second lane for a branch and closes it on merge', () => {
		// a -> merge(b) of mainline c and feature d, both rejoining at e
		const { rows, laneCount } = computeGraph([
			commit('a', ['b']),
			commit('b', ['c', 'd']),
			commit('c', ['e']),
			commit('d', ['e']),
			commit('e', ['f']),
			commit('f', [])
		]);
		expect(laneCount).toBe(2);

		const byOid = Object.fromEntries(rows.map((row) => [row.commit.oid, row]));
		// the merge sends its first parent down its own column and forks a second lane
		expect(byOid.b.col).toBe(0);
		expect(byOid.b.bottom).toEqual([
			{ from: 0, to: 0, color: expect.any(String) },
			{ from: 0, to: 1, color: expect.any(String) }
		]);
		// the feature commit sits in the second lane and merges back into the mainline,
		// which is already reserved one lane to its left
		expect(byOid.d.col).toBe(1);
		expect(byOid.d.passes).toContain(0);
		expect(byOid.d.bottom).toEqual([{ from: 1, to: 0, color: expect.any(String) }]);
		// the shared parent then continues alone in the first lane
		expect(byOid.e.col).toBe(0);
		expect(byOid.e.top).toEqual([{ from: 0, to: 0, color: expect.any(String) }]);
		// lane 1 is free again below the merge
		expect(byOid.f.passes).toEqual([]);
	});

	it('flags a stub instead of an edge when all parents fall outside the window', () => {
		const { rows } = computeGraph([commit('a', ['b']), commit('b', ['off-screen'])]);
		expect(rows[1].bottom).toEqual([]);
		expect(rows[1].hasStub).toBe(true);
		// a true root has no stub, its history really does end
		expect(computeGraph([commit('root', [])]).rows[0].hasStub).toBe(false);
	});

	it('stubs a merge whose off-page parent leaves its column with no edge', () => {
		// m's in-view parent d already owns lane 0, so its own column would dead-end
		const { rows } = computeGraph([
			commit('a', ['d']),
			commit('m', ['off-screen', 'd']),
			commit('d', [])
		]);
		const merge = rows.find((row) => row.commit.oid === 'm')!;
		expect(merge.bottom).toEqual([{ from: 1, to: 0, color: expect.any(String) }]);
		expect(merge.hasStub).toBe(true);
		// but no stub when the in-view parent already continues straight down
		const straight = computeGraph([commit('m2', ['d2', 'off']), commit('d2', [])]);
		expect(straight.rows[0].hasStub).toBe(false);
	});

	it('passes unrelated lanes straight through a row', () => {
		// two independent tips a and x, a points to b which sits below x
		const { rows } = computeGraph([
			commit('a', ['b']),
			commit('x', ['y']),
			commit('b', []),
			commit('y', [])
		]);
		const xRow = rows.find((row) => row.commit.oid === 'x')!;
		// a's lane to b passes through the x row
		expect(xRow.passes).toContain(0);
		expect(xRow.col).toBe(1);
	});
});
