import { isStorageHealthy } from '$lib/server/cache';
import { getRateLimitState } from '$lib/server/github/client';
import { oauthEnabled } from '$lib/server/auth/oauth';
import { config } from '$lib/server/env';
import type { LayoutServerLoad } from './$types';

// Coarse "resumes in ~X" hint from the reset timestamp
function resetsIn(resetAt: number | null): string | null {
	if (!resetAt) return null;
	const mins = Math.max(1, Math.round((resetAt - Date.now()) / 60_000));
	return mins < 60 ? `about ${mins} min` : `about ${Math.round(mins / 60)} h`;
}

// Flag storage outages and rate limiting, and surface the signed-in user to the whole app
export const load: LayoutServerLoad = ({ locals }) => {
	const rate = getRateLimitState();
	return {
		storageDegraded: !isStorageHealthy(),
		rateLimited: rate.limited,
		rateLimitResetsIn: resetsIn(rate.resetAt),
		user: locals.user,
		loginEnabled: oauthEnabled(),
		// No shared token means anonymous visitors only get GitHub's tiny rate limit
		tokenMissing: !config.GITHUB_TOKEN
	};
};
