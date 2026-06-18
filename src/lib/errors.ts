import { createLogger } from './logger';

export type ErrorCode =
	| 'not_found'
	| 'unauthorized'
	| 'forbidden'
	| 'rate_limited'
	| 'upstream'
	| 'bad_input'
	| 'internal';

const STATUS: Record<ErrorCode, number> = {
	not_found: 404,
	unauthorized: 401,
	forbidden: 403,
	rate_limited: 429,
	upstream: 502,
	bad_input: 400,
	internal: 500
};

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
	if (error instanceof Error)
		return new AppError('internal', error.message, { cause: error, expose: false });
	return new AppError('internal', 'Unexpected error', { cause: error, expose: false });
}

// Log an error against a scope and return the normalized form
export function logError(scope: string, error: unknown): AppError {
	const appError = toAppError(error);
	const log = createLogger(scope);
	const meta = { code: appError.code, cause: appError.cause };
	if (appError.status >= 500) log.error(appError.message, meta);
	else log.warn(appError.message, meta);
	return appError;
}

// A user-safe error, the shape every panel and page renders
export type DisplayError = { title: string; message: string };

// Shape a thrown error into something a panel or page can render
export function toDisplayError(error: unknown): DisplayError {
	const appError = toAppError(error);
	return {
		title: appError.code.replace(/_/g, ' '),
		message: appError.expose ? appError.message : 'Something went wrong'
	};
}
