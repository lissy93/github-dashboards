import { createLogger } from './logger';

export type ErrorCode =
	| 'not_found'
	| 'unauthorized'
	| 'session_expired'
	| 'forbidden'
	| 'rate_limited'
	| 'upstream'
	| 'bad_input'
	| 'unavailable'
	| 'pending'
	| 'internal';

const STATUS: Record<ErrorCode, number> = {
	not_found: 404,
	unauthorized: 401,
	session_expired: 401,
	forbidden: 403,
	rate_limited: 429,
	upstream: 502,
	bad_input: 400,
	unavailable: 503,
	// Not an error, the upstream is still computing the result
	pending: 202,
	internal: 500
};

// Connection-level failures, mostly the database being unreachable
const CONNECTION_CODES = new Set([
	'ECONNREFUSED',
	'ENOTFOUND',
	'ETIMEDOUT',
	'ECONNRESET',
	'EHOSTUNREACH',
	'EPIPE',
	'CONNECTION_REFUSED',
	'CONNECTION_ENDED',
	'CONNECTION_DESTROYED',
	'CONNECTION_CLOSED',
	'CONNECTION_CONNECT_TIMEOUT'
]);

// Walk the cause chain to spot a refused or dropped connection
export function isConnectionError(error: unknown): boolean {
	let current: unknown = error;
	while (current instanceof Error) {
		const code = (current as { code?: unknown }).code;
		if (typeof code === 'string' && CONNECTION_CODES.has(code)) return true;
		current = (current as { cause?: unknown }).cause;
	}
	return false;
}

// The deepest cause message, database failures arrive wrapped in ORM layers
export function rootReason(error: unknown): string {
	let current: unknown = error;
	while (current instanceof Error && current.cause instanceof Error) current = current.cause;
	return current instanceof Error ? current.message : String(current);
}

// App-wide error with a code, http status and a message safe to show users
export class AppError extends Error {
	code: ErrorCode;
	status: number;
	expose: boolean;
	constructor(
		code: ErrorCode,
		message: string,
		options: { cause?: unknown; expose?: boolean } = {}
	) {
		super(message, { cause: options.cause });
		this.name = 'AppError';
		this.code = code;
		this.status = STATUS[code];
		this.expose = options.expose ?? true;
	}
}

// Coerce anything thrown into a known AppError
export function toAppError(error: unknown): AppError {
	if (error instanceof AppError) return error;
	if (isConnectionError(error))
		return new AppError('unavailable', 'Could not reach the database', {
			cause: error,
			expose: true
		});
	if (error instanceof Error)
		return new AppError('internal', error.message, { cause: error, expose: false });
	return new AppError('internal', 'Unexpected error', { cause: error, expose: false });
}

// Log an error against a scope and return the normalized form
export function logError(scope: string, error: unknown): AppError {
	const appError = toAppError(error);
	const log = createLogger(scope);
	// A storage outage is a handled degradation, keep it to a compact warning
	if (appError.code === 'unavailable') {
		log.warn(appError.message, { code: appError.code });
		return appError;
	}
	const meta = { code: appError.code, cause: appError.cause };
	if (appError.status >= 500) log.error(appError.message, meta);
	else log.warn(appError.message, meta);
	return appError;
}

// A user-safe error, the shape every panel and page renders
export type DisplayError = { title: string; message: string; code?: ErrorCode; pending?: boolean };

// A parsed apiError response body is already display-shaped
function isDisplayError(value: unknown): value is DisplayError {
	if (typeof value !== 'object' || value === null) return false;
	const { title, message } = value as DisplayError;
	return typeof title === 'string' && typeof message === 'string';
}

// Shape a thrown error into something a panel or page can render. Error bodies
// thrown by fetchApi pass straight through, keeping the server's message
export function toDisplayError(error: unknown): DisplayError {
	if (isDisplayError(error)) return error;
	const appError = toAppError(error);
	return {
		title: appError.code.replace(/_/g, ' '),
		message: appError.expose ? appError.message : 'Something went wrong',
		code: appError.code,
		// A pending upstream is a soft, self-healing state, not a real failure
		pending: appError.code === 'pending'
	};
}
