import { describe, it, expect } from 'vitest';
import { summarise } from '$lib/server/github/workflows';

const workflow = { id: 1, name: 'CI', state: 'active', path: '.github/workflows/ci.yml' };

const run = (over: Partial<Parameters<typeof summarise>[1][number]> = {}) => ({
	status: 'completed',
	conclusion: 'success',
	html_url: 'https://example.com',
	created_at: '2024-01-01T00:00:00Z',
	run_started_at: '2024-01-01T00:00:00Z',
	updated_at: '2024-01-01T00:01:00Z',
	...over
});

describe('summarise', () => {
	it('computes pass rate over completed runs only', () => {
		const result = summarise(workflow, [
			run({ conclusion: 'success' }),
			run({ conclusion: 'failure' }),
			run({ status: 'in_progress', conclusion: null })
		]);
		// Two completed runs, one passing
		expect(result.passRate).toBe(0.5);
		expect(result.runsSampled).toBe(2);
	});

	it('excludes cancelled and skipped runs from pass rate and the sampled count', () => {
		const result = summarise(workflow, [
			run({ conclusion: 'success' }),
			run({ conclusion: 'failure' }),
			run({ conclusion: 'cancelled' }),
			run({ conclusion: 'skipped' })
		]);
		// Only the two decisive runs back the stats, so the displayed count matches them
		expect(result.passRate).toBe(0.5);
		expect(result.runsSampled).toBe(2);
	});

	it('averages runtime from start to end of completed runs', () => {
		const result = summarise(workflow, [
			run({ updated_at: '2024-01-01T00:01:00Z' }), // 60s
			run({ updated_at: '2024-01-01T00:03:00Z' }) // 180s
		]);
		expect(result.avgRuntimeSec).toBe(120);
	});

	it('takes the latest run as the headline status', () => {
		const result = summarise(workflow, [
			run({ conclusion: 'failure', html_url: 'https://latest' }),
			run({ conclusion: 'success' })
		]);
		expect(result.latest?.conclusion).toBe('failure');
		expect(result.latest?.runUrl).toBe('https://latest');
	});

	it('returns null metrics when there are no completed runs', () => {
		const result = summarise(workflow, [run({ status: 'in_progress', conclusion: null })]);
		expect(result.passRate).toBeNull();
		expect(result.avgRuntimeSec).toBeNull();
	});

	it('ignores invalid negative runtimes', () => {
		const result = summarise(workflow, [
			run({
				run_started_at: '2024-01-01T00:02:00Z',
				updated_at: '2024-01-01T00:01:00Z'
			})
		]);
		expect(result.avgRuntimeSec).toBeNull();
	});
});
