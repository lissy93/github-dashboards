import { AsyncLocalStorage } from 'node:async_hooks';
import { appToken } from '$lib/server/github/app-token';

// Marks a request pinned to the shared app identity, resolved to a live token on read
const APP = Symbol('app token');

const storage = new AsyncLocalStorage<string | typeof APP>();

// Run a request with the logged-in user's GitHub token bound to it
export function withToken<T>(token: string | undefined, run: () => T): T {
	return token ? storage.run(token, run) : run();
}

// Force the shared app identity for a fetch, so its shared-cached result is the same for everyone
export function withAppToken<T>(run: () => T): T {
	return storage.run(APP, run);
}

// The token for the current request, falling back to the shared app token
export function activeToken(): string {
	const store = storage.getStore();
	return typeof store === 'string' ? store : appToken();
}

// Whether the current request is on the shared app identity rather than a viewer token
export function usingAppToken(): boolean {
	return typeof storage.getStore() !== 'string';
}

// Which token the current request uses, for rate-limit diagnostics
export function tokenSource(): 'viewer' | 'app' | 'anon' {
	if (typeof storage.getStore() === 'string') return 'viewer';
	return activeToken() ? 'app' : 'anon';
}
