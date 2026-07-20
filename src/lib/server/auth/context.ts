import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from '$lib/server/env';

const storage = new AsyncLocalStorage<string>();

// Run a request with the logged-in user's GitHub token bound to it
export function withToken<T>(token: string | undefined, run: () => T): T {
	return token ? storage.run(token, run) : run();
}

// Force the shared app token for a fetch, so its shared-cached result is the same for everyone
export function withAppToken<T>(run: () => T): T {
	return storage.run(config.GITHUB_TOKEN, run);
}

// The token for the current request, falling back to the shared app token
export function activeToken(): string {
	return storage.getStore() ?? config.GITHUB_TOKEN;
}

// Whether the request is already on the shared token, so admin-gated fetches know a
// retry under it would change nothing
export function usingAppToken(): boolean {
	return activeToken() === config.GITHUB_TOKEN;
}

// Which token the current request uses, for rate-limit diagnostics
export function tokenSource(): 'viewer' | 'app' | 'anon' {
	const store = storage.getStore();
	if (store && store !== config.GITHUB_TOKEN) return 'viewer';
	return config.GITHUB_TOKEN ? 'app' : 'anon';
}
