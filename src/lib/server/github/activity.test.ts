import { describe, expect, it } from 'vitest';
import { mergeLifecycleMonths } from '$lib/server/github/activity';

describe('mergeLifecycleMonths', () => {
	it('merges and dedupes stored events with commit months, keyed lower-case', () => {
		const out = mergeLifecycleMonths(
			{ 'owner/repo': ['2024-01-01', '2024-03-01'] },
			{ 'Owner/Repo': ['2024-03-01', '2024-08-01'] }
		);
		expect(out['owner/repo']).toEqual(['2024-01-01', '2024-03-01', '2024-08-01']);
	});
});
