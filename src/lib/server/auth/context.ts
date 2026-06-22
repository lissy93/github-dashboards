import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from '$lib/server/env';

const storage = new AsyncLocalStorage<string>();

// Run a request with the logged-in user's GitHub token bound to it
export function withToken<T>(token: string | undefined, run: () => T): T {
	return token ? storage.run(token, run) : run();
}

// The token for the current request, falling back to the shared app token
export function activeToken(): string {
	return storage.getStore() ?? config.GITHUB_TOKEN;
}
