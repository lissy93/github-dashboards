import { config } from '$lib/server/env';
import { AppError } from '$lib/errors';
import type { Session } from '$lib/server/auth/session';

// Identity plus push access to public repos, the latter needed to read repo
// traffic. No private-repo read, so the shared public cache stays clean
const SCOPE = 'read:user public_repo';

// Whether GitHub OAuth is fully configured, gates the login UI
export function oauthEnabled(): boolean {
	return Boolean(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET && config.SESSION_SECRET);
}

// GitHub consent URL to send the user to, carrying our CSRF state
export function authorizeUrl(state: string, redirectUri: string): string {
	const params = new URLSearchParams({
		client_id: config.GITHUB_CLIENT_ID,
		redirect_uri: redirectUri,
		scope: SCOPE,
		state,
		allow_signup: 'true'
	});
	return `${config.GITHUB_OAUTH_AUTHORIZE}?${params}`;
}

// Swap the callback code for a user access token
async function exchangeCode(code: string, redirectUri: string): Promise<string> {
	const res = await fetch(config.GITHUB_OAUTH_TOKEN, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			client_id: config.GITHUB_CLIENT_ID,
			client_secret: config.GITHUB_CLIENT_SECRET,
			code,
			redirect_uri: redirectUri
		})
	});
	if (!res.ok) throw new AppError('upstream', `GitHub token exchange failed (${res.status})`);
	const body = (await res.json()) as { access_token?: string; error_description?: string };
	if (!body.access_token)
		throw new AppError('unauthorized', body.error_description ?? 'GitHub returned no token');
	return body.access_token;
}

// Identify the token owner so we can greet and link them
async function fetchViewer(token: string): Promise<Omit<Session, 'token'>> {
	const res = await fetch(`${config.GITHUB_API}/user`, {
		headers: {
			Authorization: `Bearer ${token}`,
			'User-Agent': 'goard',
			Accept: 'application/vnd.github+json'
		}
	});
	if (!res.ok) throw new AppError('upstream', `Could not load GitHub profile (${res.status})`);
	const user = (await res.json()) as { login: string; name: string | null; avatar_url: string };
	return { login: user.login, name: user.name, avatarUrl: user.avatar_url };
}

// Full callback flow, code to token to identity to a ready session
export async function completeLogin(code: string, redirectUri: string): Promise<Session> {
	const token = await exchangeCode(code, redirectUri);
	const viewer = await fetchViewer(token);
	return { token, ...viewer };
}
