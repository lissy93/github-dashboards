import { cached, isCached } from '$lib/server/cache';
import { AppError } from '$lib/errors';
import { createLogger } from '$lib/logger';

const log = createLogger('scorecard');

// The upstream scan runs weekly, so a long cache is honest and spares the host
const TTL = 86400;
const TIMEOUT = 15000;
const BASE = 'https://api.scorecard.dev/projects/github.com';

export type ScorecardCheck = {
	name: string;
	score: number;
	reason: string | null;
	details: string[] | null;
	documentation: { short: string; url: string } | null;
};
export type RepoScorecard = {
	available: boolean;
	score: number | null;
	generatedAt: string | null;
	scorecardVersion: string | null;
	checks: ScorecardCheck[];
};

type RawScorecard = {
	date?: string;
	scorecard?: { version?: string };
	score?: number;
	checks?: {
		name: string;
		score: number;
		reason: string | null;
		details: string[] | null;
		documentation?: { short: string; url: string } | null;
	}[];
};

export const UNAVAILABLE: RepoScorecard = {
	available: false,
	score: null,
	generatedAt: null,
	scorecardVersion: null,
	checks: []
};

// Keep only safe documentation links from the upstream payload
function documentation(
	value: { short: string; url: string } | null | undefined
): ScorecardCheck['documentation'] {
	if (!value) return null;
	try {
		return new URL(value.url).protocol === 'https:' ? value : null;
	} catch {
		return null;
	}
}

// Fetch the public OpenSSF scorecard. 404 means the repo was never scanned, which
// is a normal "not available" state, not an error. Only real failures throw
async function fetchScorecard(owner: string, name: string): Promise<RepoScorecard> {
	let res: Response;
	try {
		res = await fetch(`${BASE}/${owner}/${name}`, {
			headers: { Accept: 'application/json', 'User-Agent': 'goard' },
			signal: AbortSignal.timeout(TIMEOUT)
		});
	} catch (error) {
		log.warn(`scorecard request failed for ${owner}/${name}`, error);
		throw new AppError('upstream', 'Could not reach the OpenSSF scorecard service', {
			expose: false
		});
	}

	if (res.status === 404) return UNAVAILABLE;
	if (!res.ok) {
		log.warn(`scorecard ${res.status} for ${owner}/${name}`);
		throw new AppError('upstream', 'The OpenSSF scorecard service is unavailable', {
			expose: false
		});
	}

	const raw = (await res.json()) as RawScorecard;
	return {
		available: true,
		score: raw.score ?? null,
		generatedAt: raw.date ?? null,
		scorecardVersion: raw.scorecard?.version ?? null,
		checks: (raw.checks ?? []).map((check) => ({
			name: check.name,
			score: check.score,
			reason: check.reason,
			details: check.details,
			documentation: documentation(check.documentation)
		}))
	};
}

const key = (owner: string, name: string) => `repo:scorecard:v2:${owner}/${name}`.toLowerCase();

export const isScorecardCached = (owner: string, name: string) => isCached(key(owner, name));

// OpenSSF scorecard for a public repo. Callers must skip private repos, the public
// API holds no data for them and we should not send the name to an external host
export function getScorecard(owner: string, name: string): Promise<RepoScorecard> {
	return cached(key(owner, name), () => fetchScorecard(owner, name), TTL);
}
