import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', async (original) => ({
	...(await original<typeof import('$app/environment')>()),
	browser: true
}));

const { loadJson } = await import('$lib/state/api');
const { noteSession, session } = await import('$lib/state/session.svelte');

afterEach(() => vi.unstubAllGlobals());

describe('session', () => {
	it('ignores failures that are not a rejected sign-in', () => {
		noteSession({ title: 'unauthorized', message: '', code: 'unauthorized' });
		noteSession(null);
		expect(session.expired).toBe(false);
	});

	it('flags a rejected sign-in from any api call', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({ title: 'session expired', message: '', code: 'session_expired' }),
						{ status: 401 }
					)
			)
		);
		const result = await loadJson('octocat', 'tasks');
		expect(result.ok).toBe(false);
		expect(session.expired).toBe(true);
	});
});
