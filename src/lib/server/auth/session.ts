import type { Cookies } from '@sveltejs/kit';
import { z } from 'zod';
import { dev } from '$app/environment';
import { encrypt, decrypt } from '$lib/server/auth/crypto';

// Full session, token included, only ever read server-side
export type Session = z.infer<typeof sessionSchema>;

const sessionSchema = z.object({
	token: z.string().min(1),
	login: z.string().min(1),
	name: z.string().nullable(),
	avatarUrl: z.string().url()
});

const SESSION_COOKIE = 'gh_session';
const STATE_COOKIE = 'gh_oauth_state';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const STATE_MAX_AGE = 60 * 10;

// Shared cookie flags, secure only off in dev so OAuth works over http locally
const baseCookie = { path: '/', httpOnly: true, sameSite: 'lax', secure: !dev } as const;

// Persist the session as an encrypted cookie
export function setSession(cookies: Cookies, session: Session): void {
	cookies.set(SESSION_COOKIE, encrypt(JSON.stringify(session)), {
		...baseCookie,
		maxAge: SESSION_MAX_AGE
	});
}

// Read and verify the session, null when absent, tampered or stale-shaped
export function readSession(cookies: Cookies): Session | null {
	const raw = cookies.get(SESSION_COOKIE);
	if (!raw) return null;
	const plain = decrypt(raw);
	if (!plain) return null;
	const parsed = sessionSchema.safeParse(JSON.parse(plain));
	return parsed.success ? parsed.data : null;
}

export function clearSession(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

// Stash the CSRF state we expect back from the OAuth redirect
export function setState(cookies: Cookies, state: string): void {
	cookies.set(STATE_COOKIE, state, { ...baseCookie, maxAge: STATE_MAX_AGE });
}

export function readState(cookies: Cookies): string | undefined {
	return cookies.get(STATE_COOKIE);
}

export function clearState(cookies: Cookies): void {
	cookies.delete(STATE_COOKIE, { path: '/' });
}
