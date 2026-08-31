import { describe, it, expect } from 'vitest';
import { settled, type Crawl } from '$lib/server/github/timeline-crawl';

const crawl = (nodes: { id: string }[], overrides: Partial<Crawl<{ id: string }>> = {}) => ({
	nodes,
	cursor: 'abc',
	complete: false,
	total: 2,
	openTotal: 1,
	syncedAt: '2026-01-01T00:00:00.000Z',
	...overrides
});

describe('settled', () => {
	const current = crawl([{ id: 'a' }, { id: 'b' }]);

	it('keeps the stored crawl when only the sync time moved', () => {
		const next = crawl([{ id: 'a' }, { id: 'b' }], { syncedAt: '2026-06-01T00:00:00.000Z' });
		expect(settled(current, next)).toBe(current);
	});

	it('takes the new crawl when anything else moved', () => {
		expect(settled(current, crawl([{ id: 'a' }, { id: 'c' }]))).not.toBe(current);
		expect(settled(current, crawl(current.nodes, { total: 3 }))).not.toBe(current);
		expect(settled(current, crawl(current.nodes, { cursor: 'def' }))).not.toBe(current);
		expect(settled(current, crawl(current.nodes, { complete: true }))).not.toBe(current);
	});
});
