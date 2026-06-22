import { redirect, error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { oauthEnabled, authorizeUrl } from '$lib/server/auth/oauth';
import { setState } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

// Kick off the OAuth dance, stashing CSRF state before sending the user to GitHub
export const GET: RequestHandler = ({ cookies, url }) => {
	if (!oauthEnabled()) error(503, 'GitHub login is not configured');
	const state = randomUUID();
	setState(cookies, state);
	redirect(302, authorizeUrl(state, `${url.origin}/auth/github/callback`));
};
