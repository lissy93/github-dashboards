import { browser } from '$app/environment';

// Flipped when GitHub rejects the viewer's token, a revoked sign-in otherwise fails silently
let expired = $state(false);

// Check a failed api body, the browser only so one viewer's state never leaks into SSR
export function noteSession(body: unknown): void {
	if (browser && (body as { code?: string } | null)?.code === 'session_expired') expired = true;
}

export const session = {
	get expired() {
		return expired;
	}
};
