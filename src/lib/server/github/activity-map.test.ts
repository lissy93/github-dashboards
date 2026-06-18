import { describe, it, expect } from 'vitest';
import {
	mapEvent,
	prToActivities,
	issueToActivities,
	truncate,
	encodeCursor,
	decodeCursor,
	type RawEvent,
	type BackfillItem
} from '$lib/server/github/activity-map';

const event = (type: string, payload: object, id = '1'): RawEvent => ({
	id,
	type,
	repo: { name: 'octocat/hello' },
	payload,
	created_at: '2026-06-01T00:00:00Z'
});

describe('mapEvent', () => {
	it('collapses a push into one row with the commit count', () => {
		const result = mapEvent(
			event('PushEvent', {
				size: 3,
				ref: 'refs/heads/main',
				commits: [
					{ message: 'a', sha: 'x' },
					{ message: 'b\nbody', sha: 'head' }
				]
			})
		);
		expect(result?.type).toBe('push');
		expect(result?.payload).toEqual({ count: 3, branch: 'main' });
		expect(result?.title).toBe('b');
		expect(result?.url).toBe('https://github.com/octocat/hello/commit/head');
	});

	it('keys a PR by repo and number, and treats the merged action as merged', () => {
		const direct = mapEvent(
			event('PullRequestEvent', { action: 'merged', pull_request: { number: 7 } })
		);
		expect(direct?.action).toBe('merged');
		expect(direct?.id).toBe('pr:octocat/hello#7:merged');

		const flagged = mapEvent(
			event('PullRequestEvent', { action: 'closed', pull_request: { number: 7, merged: true } })
		);
		expect(flagged?.id).toBe('pr:octocat/hello#7:merged');
	});

	it('builds a PR url and null title when the thin feed omits them', () => {
		const result = mapEvent(
			event('PullRequestEvent', { action: 'opened', pull_request: { number: 7 } })
		);
		expect(result?.url).toBe('https://github.com/octocat/hello/pull/7');
		expect(result?.title).toBeNull();
		expect(result?.id).toBe('pr:octocat/hello#7:opened');
	});

	it('skips noise PR actions like labeled', () => {
		const result = mapEvent(
			event('PullRequestEvent', { action: 'labeled', pull_request: { number: 7 } })
		);
		expect(result).toBeNull();
	});

	it('falls back to a constructed commit url when the push lacks a sha', () => {
		const result = mapEvent(
			event('PushEvent', { ref: 'refs/heads/main', commits: [{ message: 'x' }] })
		);
		expect(result?.payload).toEqual({ count: 1, branch: 'main' });
		expect(result?.url).toBe('https://github.com/octocat/hello/commits/main');
	});

	it('distinguishes a comment on a PR from one on an issue', () => {
		const onIssue = mapEvent(
			event('IssueCommentEvent', {
				issue: { title: 'Bug', html_url: 'u', number: 2 },
				comment: { body: 'me too', html_url: 'c' }
			})
		);
		expect(onIssue?.type).toBe('comment');
		expect(onIssue?.payload).toMatchObject({ on: 'issue' });

		const onPr = mapEvent(
			event('IssueCommentEvent', {
				issue: { title: 'Bug', html_url: 'u', number: 2, pull_request: { url: 'x' } },
				comment: { body: 'lgtm', html_url: 'c' }
			})
		);
		expect(onPr?.payload).toMatchObject({ on: 'pr' });
	});

	it('maps a release using its name', () => {
		const result = mapEvent(
			event('ReleaseEvent', {
				action: 'published',
				release: { name: 'v1.0', tag_name: 'v1.0.0', html_url: 'r', body: 'notes' }
			})
		);
		expect(result?.type).toBe('release');
		expect(result?.title).toBe('v1.0');
		expect(result?.payload).toEqual({ tag: 'v1.0.0' });
	});

	it('maps a star with a repo link', () => {
		const result = mapEvent(event('WatchEvent', { action: 'started' }));
		expect(result?.type).toBe('star');
		expect(result?.url).toBe('https://github.com/octocat/hello');
	});

	it('returns null for unknown event types', () => {
		expect(mapEvent(event('SponsorshipEvent', {}))).toBeNull();
	});
});

describe('backfill mappers share ids with the events feed', () => {
	const pr: BackfillItem = {
		number: 7,
		title: 'Fix',
		url: 'u',
		createdAt: '2026-05-01T00:00:00Z',
		mergedAt: '2026-05-02T00:00:00Z',
		closedAt: '2026-05-02T00:00:00Z',
		repository: { nameWithOwner: 'octocat/hello' }
	};

	it('derives opened and merged rows whose ids match a feed merge', () => {
		const rows = prToActivities(pr);
		expect(rows.map((row) => row.id)).toEqual([
			'pr:octocat/hello#7:opened',
			'pr:octocat/hello#7:merged'
		]);
		const feed = mapEvent(
			event('PullRequestEvent', { action: 'merged', pull_request: { number: 7 } })
		);
		expect(feed?.id).toBe('pr:octocat/hello#7:merged');
	});

	it('uses closed when a PR was closed without merging', () => {
		const rows = prToActivities({ ...pr, mergedAt: null });
		expect(rows.map((row) => row.id)).toEqual([
			'pr:octocat/hello#7:opened',
			'pr:octocat/hello#7:closed'
		]);
	});

	it('derives only opened for an open issue', () => {
		const rows = issueToActivities({
			number: 2,
			title: 'Bug',
			url: 'u',
			createdAt: '2026-05-01T00:00:00Z',
			closedAt: null,
			repository: { nameWithOwner: 'octocat/hello' }
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe('issue:octocat/hello#2:opened');
	});
});

describe('truncate', () => {
	it('collapses whitespace and clips with an ellipsis', () => {
		expect(truncate('a   b\n\nc', 100)).toBe('a b c');
		expect(truncate('abcdef', 4)).toBe('abc…');
	});

	it('returns an empty string for missing text', () => {
		expect(truncate(undefined, 100)).toBe('');
		expect(truncate(null, 100)).toBe('');
	});
});

describe('cursor', () => {
	it('round-trips createdAt and id', () => {
		const cursor = encodeCursor({ createdAt: '2026-06-01T00:00:00Z', id: 'pr:PR_1:merged' });
		expect(decodeCursor(cursor)).toEqual({
			createdAt: '2026-06-01T00:00:00Z',
			id: 'pr:PR_1:merged'
		});
	});

	it('returns null for malformed input', () => {
		expect(decodeCursor(Buffer.from('nopipe').toString('base64url'))).toBeNull();
		expect(decodeCursor('!!!not base64!!!')).toBeNull();
	});
});
