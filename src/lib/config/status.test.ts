import { describe, it, expect } from 'vitest';
import { panelCause, STATUS_CAUSES } from './status';
import type { DisplayError } from '$lib/utils/errors';

const err = (partial: Partial<DisplayError>): DisplayError => ({
	title: 't',
	message: 'm',
	...partial
});

describe('panelCause', () => {
	it('resolves the healthy states by precedence', () => {
		expect(panelCause({})).toBe('ok');
		expect(panelCause({ capped: true })).toBe('partial');
		expect(panelCause({ empty: true })).toBe('empty');
		expect(panelCause({ loading: true })).toBe('loading');
	});

	it('lets an explicit cause override empty and capped', () => {
		expect(panelCause({ empty: true, cause: 'low_data' })).toBe('low_data');
		expect(panelCause({ cause: 'forbidden' })).toBe('forbidden');
	});

	it('maps upstream error codes to warn causes, errors winning over everything', () => {
		expect(panelCause({ error: err({ code: 'forbidden' }), empty: true })).toBe('forbidden');
		expect(panelCause({ error: err({ code: 'unauthorized' }) })).toBe('needs_auth');
		expect(panelCause({ error: err({ code: 'rate_limited' }) })).toBe('rate_limited');
		expect(panelCause({ error: err({ code: 'not_found' }) })).toBe('not_found');
	});

	it('treats a pending upstream as computing, and unknown codes as a hard error', () => {
		expect(panelCause({ error: err({ code: 'pending', pending: true }) })).toBe('pending');
		expect(panelCause({ error: err({ code: 'internal' }) })).toBe('error');
		expect(panelCause({ error: err({}) })).toBe('error');
	});

	it('assigns every cause a level so the report can always classify it', () => {
		for (const cause of Object.values(STATUS_CAUSES)) {
			expect(['ok', 'info', 'warn', 'error']).toContain(cause.level);
		}
	});
});
