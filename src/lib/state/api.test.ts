import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadJson, loadOwnedMap, isTransient } from '$lib/state/api';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('isTransient', () => {
	it('retries only gateway and unavailable failures, not permanent ones', () => {
		expect(isTransient({ title: '', message: '', code: 'upstream' })).toBe(true);
		expect(isTransient({ title: '', message: '', code: 'unavailable' })).toBe(true);
		expect(isTransient({ title: '', message: '', code: 'rate_limited' })).toBe(false);
		expect(isTransient({ title: '', message: '', code: 'not_found' })).toBe(false);
		expect(isTransient({ title: '', message: '' })).toBe(false);
	});
});

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

	it('retries a transient failure, then resolves once the endpoint recovers', async () => {
		vi.useFakeTimers();
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ title: 'blip', message: 'gateway', code: 'upstream' }, 502)
			)
			.mockResolvedValueOnce(jsonResponse({ value: 9 }));
		vi.stubGlobal('fetch', fetch);
		const pending = loadJson<{ value: number }>('alice', 'warming');
		await vi.advanceTimersByTimeAsync(2000);
		await expect(pending).resolves.toEqual({ ok: true, data: { value: 9 } });
		expect(fetch).toHaveBeenCalledTimes(2);
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
