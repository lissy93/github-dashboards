import { describe, it, expect } from 'vitest';
import { needsResync } from '$lib/server/github/user-timeline';
import type { TimelineState } from '$lib/server/github/repo-timeline';

const ref = (openIssues: number, openPRs: number) => ({
	owner: 'lissy93',
	name: 'dashy',
	openIssues,
	openPRs
});

const crawl = (openTotal: number, syncedAt?: string) => ({
	nodes: [],
	cursor: null,
	complete: true,
	total: openTotal,
	openTotal,
	syncedAt
});

const state = (issuesOpen: number, prsOpen: number, syncedAt?: string): TimelineState => ({
	issues: crawl(issuesOpen, syncedAt),
	prs: crawl(prsOpen, syncedAt)
});

const minsAgo = (mins: number) => new Date(Date.now() - mins * 60000).toISOString();

describe('needsResync', () => {
	it('flags a stale repo whose open issue count dropped since the last sync', () => {
		// synced 10m ago with 5 open issues, now only 2 report open, so some were closed
		expect(needsResync(ref(2, 0), state(5, 0, minsAgo(10)))).toBe(true);
	});

	it('flags a stale repo whose open PR count drifted too', () => {
		expect(needsResync(ref(3, 1), state(3, 4, minsAgo(10)))).toBe(true);
	});

	it('leaves a repo alone while its last sync is still fresh', () => {
		expect(needsResync(ref(2, 0), state(5, 0, minsAgo(1)))).toBe(false);
	});

	it('leaves a repo alone when its open counts still match', () => {
		expect(needsResync(ref(5, 3), state(5, 3, minsAgo(10)))).toBe(false);
	});

	it('resyncs a drifted repo crawled before sync watermarks existed', () => {
		expect(needsResync(ref(2, 0), state(5, 0, undefined))).toBe(true);
	});
});
