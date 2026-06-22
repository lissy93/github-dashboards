import type { Handle } from '@sveltejs/kit';
import { readSession } from '$lib/server/auth/session';
import { withToken } from '$lib/server/auth/context';

// Bind the logged-in user's token to the request, anon traffic uses the app token
export const handle: Handle = ({ event, resolve }) => {
	const session = readSession(event.cookies);
	event.locals.user = session
		? { login: session.login, name: session.name, avatarUrl: session.avatarUrl }
		: null;
	return withToken(session?.token, () => resolve(event));
};
