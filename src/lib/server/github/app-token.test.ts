import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateKeyPairSync, createVerify } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }) as string;

const ENV = {
	GITHUB_TOKEN: 'pat-fallback',
	GITHUB_API: 'https://api.github.com',
	GITHUB_APP_ID: '4242',
	GITHUB_APP_PRIVATE_KEY: Buffer.from(pem).toString('base64'),
	GITHUB_APP_INSTALLATION_ID: '99'
};

// The config is read lazily, remock it per test so each import sees its own env
async function load(overrides: Partial<typeof ENV> = {}) {
	vi.resetModules();
	vi.doMock('$lib/server/env', () => ({ config: { ...ENV, ...overrides } }));
	return import('./app-token');
}

const minted = (token: string) =>
	new Response(
		JSON.stringify({ token, expires_at: new Date(Date.now() + 3600_000).toISOString() }),
		{ status: 201 }
	);

afterEach(() => vi.unstubAllGlobals());

describe('app token', () => {
	it('mints an installation token with a verifiable app JWT', async () => {
		const calls: { url: string; jwt: string }[] = [];
		vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
			const auth = String((init?.headers as Record<string, string>).Authorization);
			calls.push({ url: String(url), jwt: auth.replace('Bearer ', '') });
			return minted('ghs_live');
		});
		const app = await load();
		await app.ensureAppToken();
		expect(app.appToken()).toBe('ghs_live');
		expect(calls[0].url).toBe('https://api.github.com/app/installations/99/access_tokens');
		const [header, payload, signature] = calls[0].jwt.split('.');
		const valid = createVerify('RSA-SHA256')
			.update(`${header}.${payload}`)
			.verify(publicKey, signature, 'base64url');
		expect(valid).toBe(true);
		const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
		expect(claims.iss).toBe('4242');
		// GitHub rejects app JWTs living longer than ten minutes
		expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
	});

	it('reuses the token until near expiry', async () => {
		let mints = 0;
		vi.stubGlobal('fetch', async () => minted(`ghs_${++mints}`));
		const app = await load();
		await app.ensureAppToken();
		await app.ensureAppToken();
		expect(mints).toBe(1);
		expect(app.appToken()).toBe('ghs_1');
	});

	it('serves the PAT when unconfigured or the mint fails', async () => {
		const bare = await load({ GITHUB_APP_ID: '' });
		await bare.ensureAppToken();
		expect(bare.appToken()).toBe('pat-fallback');

		vi.stubGlobal('fetch', async () => new Response('nope', { status: 401 }));
		const failing = await load();
		await failing.ensureAppToken();
		expect(failing.appToken()).toBe('pat-fallback');
	});
});
