import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginLoading, loading } from '$lib/state/loading.svelte';
import { fetchApi } from '$lib/state/api';

afterEach(() => vi.unstubAllGlobals());

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('loading registry', () => {
	it('stays active until every task releases', () => {
		expect(loading.active).toBe(false);
		const first = beginLoading();
		const second = beginLoading();
		expect(loading.active).toBe(true);
		first();
		expect(loading.active).toBe(true);
		second();
		expect(loading.active).toBe(false);
	});

	it('releasing the same task twice never disturbs other work', () => {
		const one = beginLoading();
		const two = beginLoading();
		one();
		one();
		expect(loading.active).toBe(true);
		two();
		expect(loading.active).toBe(false);
	});
});

describe('fetchApi loading integration', () => {
	it('is active while a request is in flight and clears once it settles', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		vi.stubGlobal('fetch', vi.fn().mockReturnValue(gate.then(() => jsonResponse({ value: 1 }))));
		const pending = fetchApi('/api/x');
		expect(loading.active).toBe(true);
		release();
		await pending;
		expect(loading.active).toBe(false);
	});

	it('clears even when the request fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ title: 'nope' }, 500)));
		await expect(fetchApi('/api/x')).rejects.toBeDefined();
		expect(loading.active).toBe(false);
	});

	it('stays quiet for background pollers', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ value: 1 })));
		const pending = fetchApi('/api/x', 20000, true);
		expect(loading.active).toBe(false);
		await pending;
		expect(loading.active).toBe(false);
	});
});
