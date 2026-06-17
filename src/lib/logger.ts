import { dev, browser } from '$app/environment';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof LEVELS;

// Min level: verbose in dev, quiet client-side, info on prod servers
const minLevel: LogLevel = dev ? 'debug' : browser ? 'warn' : 'info';

const COLORS: Record<LogLevel, string> = {
	debug: '\x1b[2;37m',
	info: '\x1b[36m',
	warn: '\x1b[33m',
	error: '\x1b[31m'
};
const RESET = '\x1b[0m';

// Single sanctioned console wrapper, the rest of the app logs through this
function emit(level: LogLevel, scope: string, message: string, meta?: unknown) {
	if (LEVELS[level] < LEVELS[minLevel]) return;
	const tag = `${level.toUpperCase()} ${scope}`;
	const label = browser ? tag : `${COLORS[level]}${tag}${RESET}`;
	const line = `${label} ${message}`;
	const args = meta === undefined ? [line] : [line, meta];
	(level === 'debug' ? console.debug : console[level])(...args);
}

export function createLogger(scope: string) {
	return {
		debug: (message: string, meta?: unknown) => emit('debug', scope, message, meta),
		info: (message: string, meta?: unknown) => emit('info', scope, message, meta),
		warn: (message: string, meta?: unknown) => emit('warn', scope, message, meta),
		error: (message: string, meta?: unknown) => emit('error', scope, message, meta)
	};
}

export const logger = createLogger('app');
