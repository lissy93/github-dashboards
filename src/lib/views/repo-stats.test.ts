import { describe, it, expect } from 'vitest';
import {
	summariseStats,
	contributionCurve,
	releaseCadence,
	labelTreemap
} from '$lib/views/repo-stats';
import type { ReleaseRow } from '$lib/server/github/releases';
import type { LabelCount } from '$lib/server/github/repo-labels';

// Minimal release for cadence maths, only the dated fields matter here
const release = (tag: string, publishedAt: string, prerelease = false): ReleaseRow => ({
	name: tag,
	tag,
	publishedAt,
	prerelease,
	downloads: 0,
	hasAssets: false,
	url: '',
	author: null
});

const base = {
	totalCommits: null,
	recentCommits: null,
	priorCommits: null,
	releaseCount: null,
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

describe('contributionCurve', () => {
	it('returns null below two contributors', () => {
		expect(contributionCurve([])).toBeNull();
		expect(contributionCurve([{ contributions: 9 }])).toBeNull();
	});

	it('flattens to the diagonal with no Gini when work is even', () => {
		const curve = contributionCurve([
			{ contributions: 5 },
			{ contributions: 5 },
			{ contributions: 5 },
			{ contributions: 5 }
		]);
		expect(curve).not.toBeNull();
		expect(curve!.gini).toBeCloseTo(0, 5);
		expect(curve!.points).toHaveLength(5);
		expect(curve!.points.at(-1)).toEqual({ x: 1, y: 1 });
		expect(curve!.busFactor).toBe(2);
		// Even work, so it takes all four to clear 80%
		expect(curve!.coreFactor).toBe(4);
	});

	it('bows the curve and lifts Gini as work concentrates', () => {
		const even = contributionCurve([
			{ contributions: 4 },
			{ contributions: 4 },
			{ contributions: 4 }
		]);
		const skewed = contributionCurve([
			{ contributions: 100 },
			{ contributions: 1 },
			{ contributions: 1 }
		]);
		expect(skewed!.gini).toBeGreaterThan(even!.gini);
		expect(skewed!.busFactor).toBe(1);
		// One author already covers 80% of the work
		expect(skewed!.coreFactor).toBe(1);
		expect(skewed!.coreThreshold).toBe(0.8);
		// Cumulative share only ever climbs
		const ys = skewed!.points.map((point) => point.y);
		expect(ys).toEqual([...ys].sort((a, b) => a - b));
	});
});

describe('releaseCadence', () => {
	it('measures gaps forward in time and the median cadence', () => {
		const cadence = releaseCadence([
			release('v1', '2024-01-01T00:00:00Z'),
			release('v2', '2024-01-11T00:00:00Z'),
			release('v3', '2024-02-10T00:00:00Z')
		]);
		expect(cadence.markers.map((marker) => marker.gapDays)).toEqual([null, 10, 30]);
		expect(cadence.medianGapDays).toBe(20);
	});

	it('skips releases with no publish date', () => {
		const cadence = releaseCadence([release('v1', ''), release('v2', '2024-03-01T00:00:00Z')]);
		expect(cadence.markers).toHaveLength(1);
		expect(cadence.medianGapDays).toBeNull();
	});
});

describe('labelTreemap', () => {
	const label = (name: string, color: string, issues: number, prs: number): LabelCount => ({
		name,
		color,
		issues,
		prs,
		total: issues + prs
	});

	it('hashes the colour and splits the count into issues and PRs', () => {
		const [tile] = labelTreemap([label('bug', 'd73a4a', 8, 2)]);
		expect(tile.color).toBe('#d73a4a');
		expect(tile.value).toBe(10);
		expect(tile.rows).toEqual([
			{ label: 'Issues', value: '8' },
			{ label: 'PRs', value: '2' }
		]);
	});

	it('caps the tile count to keep the chart legible', () => {
		const many = Array.from({ length: 30 }, (_, index) => label(`l${index}`, 'cccccc', 1, 0));
		expect(labelTreemap(many, 16)).toHaveLength(16);
	});
});
