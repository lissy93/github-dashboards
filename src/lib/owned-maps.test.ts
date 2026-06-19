import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadJson, loadOwnedMap } from '$lib/owned-maps';

afterEach(() => vi.unstubAllGlobals());

describe('loadJson', () => {
	it('returns successful JSON as data', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ value: 3 }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
		);
		await expect(loadJson<{ value: number }>('alice', 'example')).resolves.toEqual({
			ok: true,
			data: { value: 3 }
		});
	});

	it('keeps an endpoint failure distinct from empty data', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ title: 'rate limited', message: 'Try again shortly' }), {
					status: 429,
					headers: { 'content-type': 'application/json' }
				})
			)
		);
		await expect(loadJson('alice', 'limited')).resolves.toEqual({
			ok: false,
			error: { title: 'rate limited', message: 'Try again shortly' }
		});
	});

	it('unwraps owned maps without losing request errors', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ repos: { 'a/r': 4 } }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
		);
		await expect(loadOwnedMap<Record<string, number>>('alice', 'repos')).resolves.toEqual({
			ok: true,
			data: { 'a/r': 4 }
		});
	});
});
