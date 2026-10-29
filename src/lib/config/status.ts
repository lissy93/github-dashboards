import type { DisplayError, ErrorCode } from '$lib/utils/errors';
import type { StatusCause, StatusLevel } from '$lib/types';

// The shared map of panel causes to their severity, label and suggested reason or action
export const STATUS_CAUSES: Record<
	StatusCause,
	{ level: StatusLevel; label: string; hint: string }
> = {
	ok: { level: 'ok', label: 'Loaded', hint: 'Data loaded fine' },
	fresh: { level: 'ok', label: 'Fresh', hint: 'Refreshed from GitHub on this visit' },
	loading: { level: 'loading', label: 'Loading', hint: 'Still fetching data' },
	refreshing: {
		level: 'loading',
		label: 'Refreshing',
		hint: 'Updating with fresh data in the background'
	},
	empty: { level: 'info', label: 'No data', hint: 'Nothing to show here yet' },
	low_data: { level: 'warn', label: 'Low data', hint: 'Too little data to draw the chart' },
	partial: { level: 'warn', label: 'Partial', hint: 'Only part of the data has loaded' },
	stale: { level: 'warn', label: 'Stale', hint: 'A refresh failed, this may be out of date' },
	pending: { level: 'warn', label: 'Computing', hint: 'GitHub is still preparing this data' },
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
	loading: { color: 'text-info', order: 2 },
	info: { color: 'text-muted-foreground', order: 3 },
	ok: { color: 'text-success', order: 4 }
};

// Gate shown when GitHub restricts a public list (stargazers/watchers) to repo admins,
// nudging a sign-in for signed-out viewers and explaining the limit for the rest
export function restrictedGate(
	noun: string,
	loggedIn: boolean
): { text: string; hint: string; cause: StatusCause } {
	return {
		text: loggedIn ? `Only repo admins can view ${noun}` : `Sign in to view ${noun}`,
		hint: 'GitHub now limits these public lists to repo admins',
		cause: loggedIn ? 'forbidden' : 'needs_auth'
	};
}

// Map an upstream error code to the matching panel cause
const CAUSE_BY_CODE: Partial<Record<ErrorCode, StatusCause>> = {
	forbidden: 'forbidden',
	unauthorized: 'needs_auth',
	session_expired: 'needs_auth',
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
