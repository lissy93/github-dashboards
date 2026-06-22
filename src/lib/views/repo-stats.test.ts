import { describe, it, expect } from 'vitest';
import { summariseStats } from '$lib/views/repo-stats';

const base = {
	totalCommits: 0,
	recentCommits: null,
	priorCommits: null,
	releaseCount: 0,
	contributorCount: null,
	contributors: null
};

describe('summariseStats', () => {
	it('passes through headline figures and derives the commit change', () => {
		const summary = summariseStats({
			...base,
			totalCommits: 500,
			recentCommits: 42,
			priorCommits: 26,
			releaseCount: 7,
			contributorCount: 31
		});
		expect(summary.totalCommits).toBe(500);
		expect(summary.recentCommits).toBe(42);
		expect(summary.commitsDelta).toBe(16);
		expect(summary.releaseCount).toBe(7);
		expect(summary.contributors).toBe(31);
	});

	it('derives the bus factor and top contributor share', () => {
		const summary = summariseStats({
			...base,
			// 6 of 20 commits clears half only after the second author
			contributors: [
				{ contributions: 6 },
				{ contributions: 5 },
				{ contributions: 4 },
				{ contributions: 3 },
				{ contributions: 2 }
			]
		});
		expect(summary.busFactor).toBe(2);
		expect(summary.topContributorShare).toBe(30);
	});

	it('leaves metrics null when their source has not arrived', () => {
		const summary = summariseStats({ ...base, totalCommits: 12 });
		expect(summary.totalCommits).toBe(12);
		expect(summary.recentCommits).toBeNull();
		expect(summary.commitsDelta).toBeNull();
		expect(summary.contributors).toBeNull();
		expect(summary.busFactor).toBeNull();
	});
});
