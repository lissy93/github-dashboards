import type { DisplayError, ErrorCode } from '$lib/utils/errors';
import type { StatusCause, StatusLevel } from '$lib/types';

// The shared map of panel causes to their severity, label and suggested reason or action
export const STATUS_CAUSES: Record<
	StatusCause,
	{ level: StatusLevel; label: string; hint: string }
> = {
	ok: { level: 'ok', label: 'Loaded', hint: 'Data loaded fine' },
	loading: { level: 'info', label: 'Loading', hint: 'Still fetching data' },
	empty: { level: 'info', label: 'No data', hint: 'Nothing to show here yet' },
	low_data: { level: 'warn', label: 'Low data', hint: 'Too little data to draw the chart' },
	partial: { level: 'info', label: 'Partial', hint: 'Showing a capped subset of the data' },
	pending: { level: 'info', label: 'Computing', hint: 'GitHub is still preparing this data' },
	forbidden: { level: 'warn', label: 'Restricted', hint: 'You cannot view this data' },
	needs_auth: { level: 'warn', label: 'Sign in needed', hint: 'Sign in with GitHub to load this' },
	rate_limited: {
		level: 'warn',
		label: 'Rate limited',
		hint: 'GitHub API limit hit, sign in for a higher limit'
	},
	not_found: { level: 'warn', label: 'Not found', hint: 'This data could not be found' },
	unavailable: { level: 'warn', label: 'Unavailable', hint: 'A service is temporarily down' },
	error: { level: 'error', label: 'Failed', hint: 'Something went wrong loading this' }
};

// Severity colour token and sort order, worst first
export const LEVEL_META: Record<StatusLevel, { color: string; order: number }> = {
	error: { color: 'text-danger', order: 0 },
	warn: { color: 'text-warning', order: 1 },
	info: { color: 'text-muted-foreground', order: 2 },
	ok: { color: 'text-success', order: 3 }
};

// Map an upstream error code to the matching panel cause
const CAUSE_BY_CODE: Partial<Record<ErrorCode, StatusCause>> = {
	forbidden: 'forbidden',
	unauthorized: 'needs_auth',
	rate_limited: 'rate_limited',
	not_found: 'not_found',
	pending: 'pending',
	unavailable: 'unavailable'
};

type PanelState = {
	loading?: boolean;
	error?: DisplayError;
	empty?: boolean;
	capped?: boolean;
	cause?: StatusCause;
};

// Resolve a panel's reported cause from its render state, errors take priority
export function panelCause(state: PanelState): StatusCause {
	if (state.error)
		return state.error.pending
			? 'pending'
			: (state.error.code && CAUSE_BY_CODE[state.error.code]) || 'error';
	if (state.loading) return 'loading';
	if (state.cause) return state.cause;
	if (state.empty) return 'empty';
	if (state.capped) return 'partial';
	return 'ok';
}
