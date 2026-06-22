import { redirect } from '@sveltejs/kit';
import { clearSession } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

// Clear the session and return home
export const POST: RequestHandler = ({ cookies }) => {
	clearSession(cookies);
	redirect(303, '/');
};
