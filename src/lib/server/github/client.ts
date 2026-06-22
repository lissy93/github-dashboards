import { config } from '$lib/server/env';
import { activeToken } from '$lib/server/auth/context';
import { AppError, type ErrorCode } from '$lib/errors';
import { createLogger } from '$lib/logger';

const log = createLogger('github');
const TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = 500;
// GitHub gateway hiccups that a quick retry usually clears
const RETRYABLE_STATUS = new Set([502, 503, 504]);
// Cap concurrent GitHub requests process-wide. The lazy per-repo enrichment (stats,
// contributors, traffic) fans out hundreds of requests at once; left unbounded that
// burst trips GitHub's secondary rate limits, which surface as cascading 502s across
// every endpoint sharing the overview. One central gate tames all callers at once.
const MAX_CONCURRENT = 6;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Exponential backoff with jitter so retried pages do not stampede together
const backoff = (attempt: number) => BACKOFF_MS * 2 ** (attempt - 1) + Math.random() * 250;

// A tiny FIFO semaphore: requests past the limit queue until a slot frees up
let active = 0;
const waiters: (() => void)[] = [];

function acquire(): Promise<void> {
	if (active < MAX_CONCURRENT) {
		active++;
		return Promise.resolve();
	}
	return new Promise((resolve) => waiters.push(resolve));
}

function release(): void {
	const next = waiters.shift();
	// Hand the slot straight to the next waiter, only freeing it when none remain
	if (next) next();
	else active--;
}

// headers sent with every GitHub request, using the logged-in token when present
function baseHeaders(): Record<string, string> {
	return {
		Authorization: `Bearer ${activeToken()}`,
		'User-Agent': 'goard',
		Accept: 'application/vnd.github+json'
	};
}

// GitHub response to error code, a 403 with Retry-After is a rate limit not forbidden
function codeFor(res: Response): ErrorCode {
	const { status } = res;
	if (status === 401) return 'unauthorized';
	if (status === 404) return 'not_found';
	const rateLimited =
		res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after');
	if (status === 429 || (status === 403 && rateLimited)) return 'rate_limited';
	if (status === 403) return 'forbidden';
	return 'upstream';
}

function logRate(res: Response) {
	const remaining = res.headers.get('x-ratelimit-remaining');
	if (remaining !== null) log.debug(`rate limit remaining ${remaining}`);
}

// Rate-limit and reset context for a failed response, so a 502 is diagnosable
function context(res: Response): string {
	const remaining = res.headers.get('x-ratelimit-remaining');
	const retryAfter = res.headers.get('retry-after');
	const reset = res.headers.get('x-ratelimit-reset');
	const parts = [
		remaining !== null && `remaining ${remaining}`,
		retryAfter && `retry-after ${retryAfter}s`,
		reset && `resets ${new Date(Number(reset) * 1000).toISOString()}`
	].filter(Boolean);
	return parts.length ? ` (${parts.join(', ')})` : '';
}

// Fetch through the concurrency gate with auth and a timeout, retrying gateway failures
async function call(url: string, init: RequestInit = {}, label = 'request'): Promise<Response> {
	await acquire();
	try {
		let lastError: unknown;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			try {
				const res = await fetch(url, {
					...init,
					headers: { ...baseHeaders(), ...init.headers },
					signal: AbortSignal.timeout(TIMEOUT_MS)
				});
				if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
					await res.body?.cancel();
					log.warn(`GitHub ${res.status} on ${label}, retry ${attempt} of ${MAX_ATTEMPTS - 1}`);
					await wait(backoff(attempt));
					continue;
				}
				return res;
			} catch (error) {
				lastError = error;
				if (attempt < MAX_ATTEMPTS) {
					await wait(backoff(attempt));
					continue;
				}
			}
		}
		if (lastError instanceof DOMException && lastError.name === 'TimeoutError')
			throw new AppError('upstream', `GitHub request timed out on ${label}`);
		throw new AppError('upstream', `GitHub request failed on ${label}`, {
			cause: lastError,
			expose: false
		});
	} finally {
		release();
	}
}

// Run a GraphQL query and return its typed data payload
export async function graphql<T>(
	query: string,
	variables: Record<string, unknown> = {}
): Promise<T> {
	// Name the operation so failures point at the query that failed, not just "GraphQL"
	const label = query.match(/\b(?:query|mutation)\s+(\w+)/)?.[1] ?? 'GraphQL';
	const res = await call(
		config.GITHUB_GRAPHQL,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query, variables })
		},
		label
	);
	logRate(res);
	if (!res.ok) {
		log.warn(`GitHub GraphQL ${res.status} on ${label}${context(res)}`);
		throw new AppError(codeFor(res), `GitHub GraphQL ${res.status}`);
	}

	const body = (await res.json()) as { data?: T; errors?: { message: string; type?: string }[] };
	if (body.errors?.length) {
		// GraphQL still says 200 when it rate-limits, so read the error type for the code
		const types = new Set(body.errors.map((error) => error.type));
		const message = body.errors.map((error) => error.message).join('; ');
		const code = types.has('NOT_FOUND')
			? 'not_found'
			: types.has('RATE_LIMITED')
				? 'rate_limited'
				: 'upstream';
		throw new AppError(code, message);
	}
	if (!body.data) throw new AppError('upstream', 'GitHub returned no data');
	return body.data;
}

// Call a REST endpoint and return the raw Response, null on 404, for header access
export async function restResponse(path: string, init?: RequestInit): Promise<Response | null> {
	const res = await call(`${config.GITHUB_API}${path}`, init, path);
	logRate(res);
	if (res.status === 404) return null;
	if (!res.ok) {
		log.warn(`GitHub REST ${res.status} on ${path}${context(res)}`);
		throw new AppError(codeFor(res), `GitHub REST ${res.status} for ${path}`);
	}
	return res;
}

// Call a GitHub REST endpoint, returning null on 404 so callers can fall back
export async function rest<T>(path: string, init?: RequestInit): Promise<T | null> {
	const res = await restResponse(path, init);
	return res ? ((await res.json()) as T) : null;
}
