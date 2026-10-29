import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/env', () => ({
	config: {
		GITHUB_TOKEN: 'pat',
		GITHUB_API: 'https://api.github.com',
		GITHUB_APP_ID: '',
		GITHUB_APP_PRIVATE_KEY: '',
		GITHUB_APP_INSTALLATION_ID: ''
	}
}));

const { rest } = await import('$lib/server/github/client');
const { withToken } = await import('$lib/server/auth/context');

afterEach(() => vi.unstubAllGlobals());

const rejectEveryToken = () =>
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('{"message":"Bad credentials"}', { status: 401 }))
	);

describe('a token GitHub rejects', () => {
	it('reads as an expired sign-in when it is the viewer token', async () => {
		rejectEveryToken();
		await expect(withToken('revoked', () => rest('/user'))).rejects.toMatchObject({
			code: 'session_expired',
			status: 401
		});
	});

	it('stays unauthorized on the shared app token, which is not the viewer to blame', async () => {
		rejectEveryToken();
		await expect(rest('/user')).rejects.toMatchObject({ code: 'unauthorized' });
	});
});
