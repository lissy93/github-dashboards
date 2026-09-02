import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { invalidateAll } = vi.hoisted(() => ({ invalidateAll: vi.fn(() => Promise.resolve()) }));
vi.mock('$app/navigation', () => ({ invalidateAll }));

const { joinPendingRetry } = await import('$lib/state/pending-retry.svelte');

beforeEach(() => {
	vi.useFakeTimers();
	invalidateAll.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('pending retry', () => {
	it('reruns the page load on a widening gap while a panel stays pending', async () => {
		const release = joinPendingRetry();
		await vi.advanceTimersByTimeAsync(4000);
		expect(invalidateAll).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(8000);
		expect(invalidateAll).toHaveBeenCalledTimes(2);
		release();
		await vi.advanceTimersByTimeAsync(60000);
		expect(invalidateAll).toHaveBeenCalledTimes(2);
	});

	it('gives up on a fetch that never lands, rather than polling forever', async () => {
		const release = joinPendingRetry();
		await vi.advanceTimersByTimeAsync(200000);
		expect(invalidateAll).toHaveBeenCalledTimes(5);
		release();
	});

	it('restarts the budget for the next slow panel', async () => {
		const release = joinPendingRetry();
		await vi.advanceTimersByTimeAsync(4000);
		expect(invalidateAll).toHaveBeenCalledTimes(1);
		release();
		await vi.advanceTimersByTimeAsync(8000);
	});

	it('shares one rerun across every pending panel on the page', async () => {
		const first = joinPendingRetry();
		const second = joinPendingRetry();
		await vi.advanceTimersByTimeAsync(4000);
		expect(invalidateAll).toHaveBeenCalledTimes(1);
		first();
		second();
		await vi.advanceTimersByTimeAsync(8000);
	});
});
