import { beforeEach, describe, it, expect, vi } from 'vitest';

type Paginate = (query: string, vars: Record<string, unknown>) => Promise<{ nodes: [] }>;
const { paginate } = vi.hoisted(() => ({
	paginate: vi.fn<Paginate>(async () => ({ nodes: [] }))
}));
vi.mock('$lib/server/github/client', () => ({ paginate }));
vi.mock('$lib/server/cache', () => ({
	cached: (_key: string, fetcher: () => unknown) => fetcher(),
	withForceFresh: (run: () => unknown) => run()
}));
vi.mock('$lib/server/github/user', () => ({
	getUserOverview: async () => ({ profile: { login: 'octocat', isOrg: false } })
}));

const { getTaskList, getClosedTaskList } = await import('$lib/server/github/tasks');
const { getRepoPullRequestsAll } = await import('$lib/server/github/repo-tasks');

// Whether each query sent so far asked for CI status, the field that times closed PRs out
const asksForChecks = () =>
	paginate.mock.calls.map(([query]) => query.includes('statusCheckRollup'));

describe('PR queries', () => {
	beforeEach(() => paginate.mockClear());

	it('asks for CI status on open review PRs', async () => {
		await getTaskList('octocat', 'reviewPrs');
		expect(asksForChecks()).not.toContain(false);
		expect(asksForChecks().length).toBeGreaterThan(0);
	});

	it('skips CI status on closed review PRs', async () => {
		await getClosedTaskList('octocat', 'reviewPrs');
		expect(asksForChecks()).not.toContain(true);
		expect(asksForChecks().length).toBeGreaterThan(0);
	});

	it('skips CI status on closed repo PRs only', async () => {
		await getRepoPullRequestsAll('octocat', 'hello-world');
		const byState = paginate.mock.calls.map(([query, vars]) => ({
			open: (vars.states as string[]).includes('OPEN'),
			checks: query.includes('statusCheckRollup')
		}));
		expect(byState).toEqual(
			expect.arrayContaining([
				{ open: true, checks: true },
				{ open: false, checks: false }
			])
		);
		expect(byState.every(({ open, checks }) => open === checks)).toBe(true);
	});
});
