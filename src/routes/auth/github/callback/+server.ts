import { redirect, error } from '@sveltejs/kit';
import { completeLogin } from '$lib/server/auth/oauth';
import { setSession, readState, clearState } from '$lib/server/auth/session';
import { logError } from '$lib/errors';
import { paths } from '$lib/config';
import type { RequestHandler } from './$types';

// Finish the OAuth dance, verify state, swap the code and start a session
export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expected = readState(cookies);
	clearState(cookies);
	if (!code || !state || state !== expected) error(400, 'Invalid login response');

	let login: string;
	try {
		const session = await completeLogin(code, `${url.origin}/auth/github/callback`);
		setSession(cookies, session);
		login = session.login;
	} catch (caught) {
		logError('oauth-callback', caught);
		redirect(302, '/?login=failed');
	}
	redirect(302, paths.user(login));
};
