import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { config } from '$lib/server/env';

const ALGO = 'aes-256-gcm';

// Stable 32-byte key derived from the configured secret
function key(): Buffer {
	return createHash('sha256').update(config.SESSION_SECRET).digest();
}

// Encrypt to a compact token, iv.tag.ciphertext in base64url
export function encrypt(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGO, key(), iv);
	const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [iv, tag, data].map((part) => part.toString('base64url')).join('.');
}

// Decrypt a token, null if it is tampered with, malformed or from an old secret
export function decrypt(token: string): string | null {
	const [iv, tag, data] = token.split('.').map((part) => Buffer.from(part, 'base64url'));
	// Node accepts truncated auth tags, so insist on the full 16 bytes
	if (iv?.length !== 12 || tag?.length !== 16 || !data?.length) return null;
	try {
		const decipher = createDecipheriv(ALGO, key(), iv);
		decipher.setAuthTag(tag);
		return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
	} catch {
		return null;
	}
}
