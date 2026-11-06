import { browser } from '$app/environment';

const RELOADED_KEY = 'challenge-reloaded';
// Don't reload again within a minute, so a failing check can't loop
const COOLDOWN_MS = 60_000;

// Vercel flags responses it answered with its own bot check
export const isChallenged = (response: Response) =>
	response.headers.get('x-vercel-mitigated') === 'challenge';

// Checks expire hourly, and only a full page load can pass one again
export function reverify(): void {
	// Home skips the check, so reloading there wouldn't help
	if (!browser || location.pathname === '/') return;
	const now = Date.now();
	try {
		if (now - Number(sessionStorage.getItem(RELOADED_KEY)) < COOLDOWN_MS) return;
		sessionStorage.setItem(RELOADED_KEY, String(now));
	} catch {
		return;
	}
	location.reload();
}
