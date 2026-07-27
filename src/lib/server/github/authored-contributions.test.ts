import { describe, it, expect } from 'vitest';
import { reduceAuthored } from '$lib/server/github/authored-contributions';
import type { AuthoredState } from '$lib/server/github/authored-timeline';

type IssueNode = AuthoredState['issues']['nodes'][number];
type PrNode = AuthoredState['prs']['nodes'][number];

const crawl = <T>(nodes: T[], complete = true) => ({
	nodes,
	cursor: null as string | null,
	complete,
	total: nodes.length,
	openTotal: 0
});

function state(issues: IssueNode[], prs: PrNode[], complete = true): AuthoredState {
	return { issues: crawl(issues, complete), prs: crawl(prs, complete) };
}

const issue = (repo: string, createdAt: string): IssueNode => ({
	id: repo + createdAt,
	createdAt,
	closedAt: null,
	stateReason: null,
	repository: { nameWithOwner: repo }
});

const pr = (
	repo: string,
	createdAt: string,
	additions = 0,
	deletions = 0,
	merged = false
): PrNode => ({
	id: `${repo}${createdAt}${additions}`,
	createdAt,
	closedAt: null,
	merged,
	additions,
	deletions,
	repository: { nameWithOwner: repo }
});

describe('reduceAuthored', () => {
	it('groups issues and PRs by year and repo with diff totals', () => {
		const result = reduceAuthored(
			state(
				[issue('acme/api', '2024-03-01'), issue('acme/api', '2024-06-01')],
				[pr('acme/api', '2024-02-01', 100, 20, true), pr('other/lib', '2023-11-01', 5, 1)]
			),
			'lissy93'
		);
		expect(result.years.map((year) => year.year)).toEqual([2024, 2023]);
		const api = result.years[0].repos.find((repo) => repo.repo === 'acme/api');
		// the one PR was merged, so it counts toward mergedPrs too
		expect(api).toMatchObject({ prs: 1, mergedPrs: 1, issues: 2, additions: 100, owned: false });
		// lastAt is the newest of the repo's items that year
		expect(api?.lastAt).toBe('2024-06-01');
		expect(result.years[1].repos[0]).toMatchObject({ repo: 'other/lib', prs: 1, issues: 0 });
	});

	it('marks repos under the user login as owned, case-insensitive', () => {
		const result = reduceAuthored(state([], [pr('Lissy93/goard', '2025-01-01', 1, 1)]), 'lissy93');
		expect(result.years[0].repos[0].owned).toBe(true);
	});

	it("ranks a year's repos by most recent contribution first", () => {
		const result = reduceAuthored(
			state(
				[],
				[
					pr('older/repo', '2024-01-05'),
					pr('newer/repo', '2024-08-01'),
					pr('older/repo', '2024-03-01')
				]
			),
			'me'
		);
		expect(result.years[0].repos.map((repo) => repo.repo)).toEqual(['newer/repo', 'older/repo']);
		expect(result.years[0].repos[0].lastAt).toBe('2024-08-01');
	});

	it('counts only merged PRs toward mergedPrs', () => {
		const result = reduceAuthored(
			state([], [pr('x/y', '2024-01-01', 0, 0, true), pr('x/y', '2024-02-01', 0, 0, false)]),
			'me'
		);
		expect(result.years[0].repos[0]).toMatchObject({ prs: 2, mergedPrs: 1 });
	});

	it('sums additions and deletions across a repo PRs', () => {
		const result = reduceAuthored(
			state([], [pr('x/y', '2024-01-01', 10, 3), pr('x/y', '2024-05-01', 4, 1)]),
			'me'
		);
		expect(result.years[0].repos[0]).toMatchObject({ prs: 2, additions: 14, deletions: 4 });
	});

	it('reports complete only when both kinds finished', () => {
		expect(reduceAuthored(state([], [], true), 'me').complete).toBe(true);
		const partial: AuthoredState = { issues: crawl([], false), prs: crawl([], true) };
		expect(reduceAuthored(partial, 'me').complete).toBe(false);
	});
});
