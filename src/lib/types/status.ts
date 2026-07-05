// Severity buckets a panel status rolls up into
export type StatusLevel = 'ok' | 'info' | 'loading' | 'warn' | 'error';

// Why a panel is in its current state, the shared vocabulary every panel reports
export type StatusCause =
	| 'ok'
	| 'loading'
	| 'empty'
	| 'low_data'
	| 'partial'
	| 'pending'
	| 'forbidden'
	| 'needs_auth'
	| 'rate_limited'
	| 'not_found'
	| 'unavailable'
	| 'error';

// One panel's reported status, collected by the page store
export type PanelReport = {
	id: string;
	title: string;
	cause: StatusCause;
	detail?: string;
};
