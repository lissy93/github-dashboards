import { describe, it, expect, vi } from 'vitest';

// The session secret is read lazily through config, stub it before importing
vi.mock('$lib/server/env', () => ({
	config: { SESSION_SECRET: 'test-secret-please-ignore' }
}));

const { encrypt, decrypt } = await import('./crypto');

describe('session crypto', () => {
	it('round-trips a value', () => {
		const secret = JSON.stringify({ token: 'gho_abc', login: 'octocat' });
		expect(decrypt(encrypt(secret))).toBe(secret);
	});

	it('produces a fresh ciphertext each time, same plaintext', () => {
		expect(encrypt('hello')).not.toBe(encrypt('hello'));
	});

	it('rejects a tampered token', () => {
		const token = encrypt('hello');
		const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A');
		expect(decrypt(tampered)).toBeNull();
	});

	it('rejects malformed input', () => {
		expect(decrypt('not-a-real-token')).toBeNull();
		expect(decrypt('')).toBeNull();
	});
});
