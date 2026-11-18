import { describe, it, expect } from 'vitest';
import { hasDrifted, needsResync } from '$lib/server/github/user-timeline';

const minsAgo = (mins: number) => new Date(Date.now() - mins * 60000);

const ref = (openIssues: number, openPRs: number, changedAt?: Date) => ({
	owner: 'lissy93',
	name: 'dashy',
	openIssues,
	openPRs,
	changedAt: changedAt?.toISOString()
});

const crawl = (openTotal: number, syncedAt: Date) => ({
	nodes: [],
	cursor: null,
	complete: true,
	total: openTotal,
	openTotal,
	syncedAt: syncedAt.toISOString()
});

// A stored crawl last swept at sweptAt, whose watermark only moves when a sweep changed something
const stored = (issuesOpen: number, prsOpen: number, sweptAt: Date, syncedAt = sweptAt) => ({
	value: { issues: crawl(issuesOpen, syncedAt), prs: crawl(prsOpen, syncedAt) },
	fetchedAt: sweptAt
});

describe('needsResync', () => {
	it('flags a stale repo whose open issue count dropped since the last sync', () => {
		// synced 10m ago with 5 open issues, now only 2 report open, so some were closed
		expect(needsResync(ref(2, 0), stored(5, 0, minsAgo(10)))).toBe(true);
	});

	it('flags a stale repo whose open PR count drifted too', () => {
		expect(needsResync(ref(3, 1), stored(3, 4, minsAgo(10)))).toBe(true);
	});

	it('leaves a repo alone while its last sync is still fresh', () => {
		expect(needsResync(ref(2, 0), stored(5, 0, minsAgo(1)))).toBe(false);
	});

	it('leaves a repo alone when its open counts still match', () => {
		expect(needsResync(ref(5, 3), stored(5, 3, minsAgo(10)))).toBe(false);
	});

	it('flags a burst that opened and closed issues between syncs, counts back where they were', () => {
		expect(needsResync(ref(0, 1, minsAgo(20)), stored(0, 1, minsAgo(60 * 24)))).toBe(true);
	});

	it('counts a sweep that found nothing new as caught up, so a comment never loops re-sweeps', () => {
		// the no-op sweep 5m ago kept its day-old watermark but still covered the 20m-old change
		const caughtUp = stored(0, 1, minsAgo(5), minsAgo(60 * 24));
		expect(hasDrifted(ref(0, 1, minsAgo(20)), caughtUp)).toBe(false);
	});
});

describe('hasDrifted', () => {
	it('flags a repo whose counts moved however recently it synced, for a forced refresh', () => {
		expect(hasDrifted(ref(2, 0), stored(5, 0, minsAgo(1)))).toBe(true);
	});

	it('flags activity newer than the last sweep however recent, for a forced refresh', () => {
		expect(hasDrifted(ref(5, 3, minsAgo(1)), stored(5, 3, minsAgo(2)))).toBe(true);
	});

	it('leaves a repo alone when its open counts still match', () => {
		expect(hasDrifted(ref(5, 3), stored(5, 3, minsAgo(1)))).toBe(false);
	});
});
