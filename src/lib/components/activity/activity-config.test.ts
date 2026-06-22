import { describe, it, expect } from 'vitest';
import { activitySummary } from './activity-config';
import type { ActivityEvent } from '$lib/types';

const push = (count: number, branch = 'main'): ActivityEvent => ({
	id: '1',
	type: 'push',
	action: 'pushed',
	createdAt: '2026-06-01T00:00:00Z',
	repo: 'octocat/hello',
	title: null,
	body: null,
	url: 'https://github.com/octocat/hello',
	payload: { count, branch },
	reactions: null
});

describe('activitySummary push phrasing', () => {
	it('counts commits with correct pluralisation', () => {
		expect(activitySummary(push(1))).toBe('pushed 1 commit to main');
		expect(activitySummary(push(3))).toBe('pushed 3 commits to main');
	});

	it('drops the misleading count for a 0-commit push', () => {
		expect(activitySummary(push(0))).toBe('pushed to main');
	});

	it('omits the branch when none is known', () => {
		expect(activitySummary(push(0, ''))).toBe('pushed');
	});
});
