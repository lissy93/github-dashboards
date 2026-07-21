import { createSign } from 'node:crypto';
import { config } from '$lib/server/env';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('app-token');

// Installation tokens last an hour, refresh ahead so requests never carry a dying one
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
// After a failed mint, ride the PAT fallback for a bit instead of re-minting per request
const RETRY_AFTER_MS = 60 * 1000;

let token = '';
let expiresAt = 0;
let nextAttempt = 0;
let minting: Promise<void> | null = null;

// Whether the GitHub App credentials are all present
export function appTokenConfigured(): boolean {
	return Boolean(
		config.GITHUB_APP_ID && config.GITHUB_APP_PRIVATE_KEY && config.GITHUB_APP_INSTALLATION_ID
	);
}

// The key arrives base64-packed or as PEM with escaped newlines, env vars mangle real ones
function privateKey(): string {
	const raw = config.GITHUB_APP_PRIVATE_KEY;
	if (raw.includes('-----')) return raw.replace(/\\n/g, '\n');
	return Buffer.from(raw, 'base64').toString('utf8');
}

// Short-lived RS256 JWT that authenticates us as the app itself
function appJwt(): string {
	const now = Math.floor(Date.now() / 1000);
	const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
	const claims = { iat: now - 60, exp: now + 540, iss: config.GITHUB_APP_ID };
	const body = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(claims)}`;
	const signature = createSign('RSA-SHA256').update(body).sign(privateKey(), 'base64url');
	return `${body}.${signature}`;
}

// Swap the app JWT for an installation token, the one with the dedicated rate-limit pool
async function mint(): Promise<void> {
	const res = await fetch(
		`${config.GITHUB_API}/app/installations/${config.GITHUB_APP_INSTALLATION_ID}/access_tokens`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${appJwt()}`,
				Accept: 'application/vnd.github+json',
				'User-Agent': 'goard'
			},
			signal: AbortSignal.timeout(10_000)
		}
	);
	if (!res.ok) throw new Error(`mint returned ${res.status}`);
	const body = (await res.json()) as { token: string; expires_at: string };
	token = body.token;
	expiresAt = Date.parse(body.expires_at);
}

// Mint or refresh the installation token, concurrent requests await the same run
export async function ensureAppToken(): Promise<void> {
	if (!appTokenConfigured()) return;
	if (Date.now() < expiresAt - REFRESH_MARGIN_MS || Date.now() < nextAttempt) return;
	minting ??= mint()
		.then(() => {
			nextAttempt = 0;
		})
		.catch((error: unknown) => {
			nextAttempt = Date.now() + RETRY_AFTER_MS;
			log.warn('installation token mint failed, serving on the PAT', {
				reason: error instanceof Error ? error.message : String(error)
			});
		})
		.finally(() => {
			minting = null;
		});
	await minting;
}

// The live installation token, or the classic shared PAT when absent or expired
export function appToken(): string {
	return token && Date.now() < expiresAt ? token : config.GITHUB_TOKEN;
}
