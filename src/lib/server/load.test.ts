import { afterEach, describe, it, expect, vi } from 'vitest';
import { inlineReady } from '$lib/server/load';

const after = <T>(ms: number, value: T) =>
	new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

describe('inlineReady', () => {
	afterEach(() => vi.useRealTimers());

	it('inlines what lands in budget and streams the rest', async () => {
		vi.useFakeTimers();
		const slow = after(10_000, 'late');
		const pending = inlineReady(
			{ fast: Promise.resolve('warm'), slow, label: 'repo', none: null },
			true
		);
		await vi.advanceTimersByTimeAsync(1000);
		const data = await pending;
		expect(data.fast).toBe('warm');
		expect(data.slow).toBe(slow);
		expect(data.label).toBe('repo');
		expect(data.none).toBeNull();
	});

	it('gives a full page load longer than a click', async () => {
		vi.useFakeTimers();
		const click = inlineReady({ data: after(300, 'done') }, true);
		const fullLoad = inlineReady({ data: after(300, 'done') }, false);
		await vi.advanceTimersByTimeAsync(1000);
		expect((await click).data).toBeInstanceOf(Promise);
		expect((await fullLoad).data).toBe('done');
	});
});
