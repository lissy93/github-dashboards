import { config } from '$lib/server/env';
import { activeToken, tokenSource, usingAppToken } from '$lib/server/auth/context';
import { ensureAppToken } from '$lib/server/github/app-token';
import { AppError, toAppError, type ErrorCode } from '$lib/utils/errors';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('github');
const TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = 500;
// GitHub gateway hiccups that a quick retry usually clears
const RETRYABLE_STATUS = new Set([502, 503, 504]);
// Failing slower than this is GitHub timing out, and a retry would only do it again
const SLOW_FAIL_MS = 5000;
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

// headers for each GitHub request, using the viewer's token when signed in and the
// shared app token otherwise, or none at all for a fully anonymous request
function baseHeaders(): Record<string, string> {
	const token = activeToken();
	return {
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		'User-Agent': 'github-dashboards',
		Accept: 'application/vnd.github+json'
	};
}

// GitHub response to error code, a 403 with Retry-After is a rate limit not forbidden
function codeFor(res: Response): ErrorCode {
	const { status } = res;
	// GitHub rejecting a viewer's token means their sign-in was revoked, not that the data is private
	if (status === 401) return tokenSource() === 'viewer' ? 'session_expired' : 'unauthorized';
	if (status === 404) return 'not_found';
	const rateLimited =
		res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after');
	if (status === 429 || (status === 403 && rateLimited)) return 'rate_limited';
	if (status === 403) return 'forbidden';
	// A GitHub 5xx is a transient upstream outage, not our failure
	if (status >= 500) return 'unavailable';
	return 'upstream';
}

// Reset time (unix ms) per drained token, so each request sees the limit state of the
// token it actually uses and one viewer's limit never flags anyone else
const rateLimitResets = new Map<string, number>();

// Whether GitHub is rate limiting the current request's token, and when it frees up
export function getRateLimitState(): { limited: boolean; resetAt: number | null } {
	const token = activeToken();
	const until = rateLimitResets.get(token);
	if (until !== undefined && Date.now() >= until) rateLimitResets.delete(token);
	const resetAt = rateLimitResets.get(token) ?? null;
	return { limited: resetAt !== null, resetAt };
}

// Remember when the current token's limit frees up, so the UI can warn
function noteRateLimited(res: Response): void {
	const retryAfter = Number(res.headers.get('retry-after'));
	const reset = Number(res.headers.get('x-ratelimit-reset'));
	// retry-after is relative seconds, reset is unix seconds, fall back to a minute out
	const until =
		retryAfter > 0
			? Date.now() + retryAfter * 1000
			: reset > 0
				? reset * 1000
				: Date.now() + 60_000;
	const token = activeToken();
	rateLimitResets.set(token, Math.max(rateLimitResets.get(token) ?? 0, until));
	for (const [key, value] of rateLimitResets) if (Date.now() >= value) rateLimitResets.delete(key);
}

// Log remaining budget and remember the reset once it hits zero
function logRate(res: Response) {
	const remaining = res.headers.get('x-ratelimit-remaining');
	if (remaining === null) return;
	log.debug(`rate limit remaining ${remaining} (${tokenSource()} token)`);
	if (remaining === '0') noteRateLimited(res);
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

// Fetch through the concurrency gate with auth and a timeout, retrying quick gateway failures
async function call(url: string, init: RequestInit = {}, label = 'request'): Promise<Response> {
	// App-identity requests ride the installation token, freshen it before headers bind
	if (usingAppToken()) await ensureAppToken();
	await acquire();
	try {
		let lastError: unknown;
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			const started = Date.now();
			const canRetry = () => attempt < MAX_ATTEMPTS && Date.now() - started < SLOW_FAIL_MS;
			try {
				const res = await fetch(url, {
					...init,
					headers: { ...baseHeaders(), ...init.headers },
					signal: AbortSignal.timeout(TIMEOUT_MS)
				});
				if (RETRYABLE_STATUS.has(res.status) && canRetry()) {
					await res.body?.cancel();
					log.warn(`GitHub ${res.status} on ${label}, retry ${attempt} of ${MAX_ATTEMPTS - 1}`);
					await wait(backoff(attempt));
					continue;
				}
				return res;
			} catch (error) {
				lastError = error;
				if (!canRetry()) break;
				await wait(backoff(attempt));
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
		const code = codeFor(res);
		if (code === 'rate_limited') noteRateLimited(res);
		log.warn(`GitHub GraphQL ${res.status} on ${label}${context(res)}`);
		throw new AppError(code, `GitHub GraphQL ${res.status}`);
	}

	const body = (await res.json()) as { data?: T; errors?: { message: string; type?: string }[] };
	if (body.errors?.length) {
		// GraphQL rate limits still return 200, and a drained budget arrives as a bare
		// "rate limit" message with no type, so match the message text as well as the type
		const types = new Set(body.errors.map((error) => error.type));
		const message = body.errors.map((error) => error.message).join('; ');
		const rateLimited =
			types.has('RATE_LIMITED') || body.errors.some((error) => /rate limit/i.test(error.message));
		// Points and secondary limits drain without the remaining header ever hitting zero
		if (rateLimited) noteRateLimited(res);
		const code = types.has('NOT_FOUND')
			? 'not_found'
			: rateLimited
				? 'rate_limited'
				: types.has('FORBIDDEN')
					? 'forbidden'
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
		const code = codeFor(res);
		if (code === 'rate_limited') noteRateLimited(res);
		log.warn(`GitHub REST ${res.status} on ${path}${context(res)}`);
		throw new AppError(code, `GitHub REST ${res.status} for ${path}`);
	}
	return res;
}

// Call a GitHub REST endpoint, returning null on 404 so callers can fall back
export async function rest<T>(path: string, init?: RequestInit): Promise<T | null> {
	const res = await restResponse(path, init);
	return res ? ((await res.json()) as T) : null;
}

export const PAGE_INFO = 'pageInfo { hasNextPage endCursor }';
export type Conn<T> = {
	nodes: T[];
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

// Walk a cursored connection page by page, up to maxPages. Each page's connection
// passes through pick, so callers can read totals off it as pages arrive. An optional
// until predicate ends the walk once a page satisfies it, reporting complete
export async function paginate<T, D>(
	query: string,
	variables: Record<string, unknown>,
	pick: (data: D) => Conn<T> | null | undefined,
	options: { maxPages: number; cursor?: string | null; until?: (page: T[]) => boolean }
): Promise<{ nodes: T[]; cursor: string | null; complete: boolean }> {
	const nodes: T[] = [];
	let cursor = options.cursor ?? null;
	for (let page = 0; page < options.maxPages; page++) {
		const conn = pick(await graphql<D>(query, { ...variables, cursor }));
		if (!conn) return { nodes, cursor, complete: true };
		nodes.push(...conn.nodes);
		if (options.until?.(conn.nodes)) return { nodes, cursor: null, complete: true };
		if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor)
			return { nodes, cursor: null, complete: true };
		cursor = conn.pageInfo.endCursor;
	}
	return { nodes, cursor, complete: false };
}

// A REST call where some statuses are expected (no access, not enabled), not errors
export async function restTolerant<T>(
	path: string,
	codes: ErrorCode[] = ['forbidden']
): Promise<T | null> {
	try {
		return await rest<T>(path);
	} catch (error) {
		if (error instanceof AppError && codes.includes(error.code)) return null;
		throw error;
	}
}

// An empty list against a known non-zero count is GitHub's admin-only restriction on
// stargazers/watchers, not a genuinely empty list
export const looksRestricted = (knownCount: number, got: number) => knownCount > 0 && got === 0;

// The same restriction refusing outright, a 403 on the app token and an internal error on a viewer's
const REFUSED: ErrorCode[] = ['forbidden', 'upstream'];
export const isRefusedList = (error: unknown) => REFUSED.includes(toAppError(error).code);

// One aliased field per item, so a whole batch resolves in a single round trip
export function batchedGraphql<T, D>(
	name: string,
	items: T[],
	params: (index: number) => string,
	field: (index: number) => string,
	variables: (item: T, index: number) => Record<string, unknown>
): Promise<Record<string, D>> {
	if (!items.length) return Promise.resolve({});
	const paramList = items.map((_, index) => params(index)).join(', ');
	const fields = items.map((_, index) => field(index)).join('\n');
	const vars = Object.assign({}, ...items.map((item, index) => variables(item, index)));
	return graphql<Record<string, D>>(`query ${name}(${paramList}) { ${fields} }`, vars);
}
