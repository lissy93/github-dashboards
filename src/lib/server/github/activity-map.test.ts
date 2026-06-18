import { describe, it, expect } from 'vitest';
import {
	mapEvent,
	prToActivities,
	issueToActivities,
	discussionToActivity,
	discussionCommentToActivity,
	commentToActivity,
	commitCommentToActivity,
	reviewToActivity,
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

	it('keeps only non-zero reaction counts from a comment', () => {
		const result = mapEvent(
			event('IssueCommentEvent', {
				issue: { title: 'Bug', html_url: 'u', number: 2 },
				comment: { body: 'me too', html_url: 'c', reactions: { '+1': 3, heart: 1, laugh: 0 } }
			})
		);
		expect(result?.reactions).toEqual({ '+1': 3, heart: 1 });
	});

	it('leaves reactions null when an event has none', () => {
		const result = mapEvent(event('WatchEvent', { action: 'started' }));
		expect(result?.reactions).toBeNull();
	});

	it('maps a resolved review thread onto the PR as a review row', () => {
		const result = mapEvent(
			event('PullRequestReviewThreadEvent', { action: 'resolved', pull_request: { number: 7 } })
		);
		expect(result?.type).toBe('review');
		expect(result?.action).toBe('resolved');
		expect(result?.url).toBe('https://github.com/octocat/hello/pull/7');
	});

	it('maps a sponsorship to the sponsorable profile with no repo crash', () => {
		const result = mapEvent({
			id: '9',
			type: 'SponsorshipEvent',
			payload: { action: 'created', sponsorship: { sponsorable: { login: 'octo' } } },
			created_at: '2026-06-01T00:00:00Z'
		});
		expect(result?.type).toBe('sponsor');
		expect(result?.repo).toBe('octo');
		expect(result?.url).toBe('https://github.com/octo');
	});
});

describe('discussion backfill mappers', () => {
	it('maps an authored discussion with a stable id and reactions', () => {
		const row = discussionToActivity({
			number: 12,
			title: 'Roadmap',
			url: 'https://github.com/octocat/hello/discussions/12',
			createdAt: '2026-05-01T00:00:00Z',
			repository: { nameWithOwner: 'octocat/hello' },
			reactionGroups: [{ content: 'HEART', reactors: { totalCount: 2 } }]
		});
		expect(row.id).toBe('disc:octocat/hello#12');
		expect(row.type).toBe('discussion');
		expect(row.reactions).toEqual({ heart: 2 });
	});

	it('maps a discussion comment as a comment row keyed by its url', () => {
		const row = discussionCommentToActivity({
			url: 'https://github.com/octocat/hello/discussions/12#discussioncomment-1',
			createdAt: '2026-05-02T00:00:00Z',
			bodyText: 'agreed',
			discussion: { number: 12, title: 'Roadmap', repository: { nameWithOwner: 'octocat/hello' } }
		});
		expect(row.type).toBe('comment');
		expect(row.payload).toMatchObject({ number: 12, on: 'discussion' });
		expect(row.id).toContain('discussioncomment-1');
		expect(row.body).toBe('agreed');
	});

	it('reads the PR vs issue target of a backfilled comment from its url', () => {
		const base = {
			createdAt: '2026-05-02T00:00:00Z',
			bodyText: 'lgtm',
			issue: { number: 5, title: 'Bug', repository: { nameWithOwner: 'octocat/hello' } }
		};
		const onPr = commentToActivity({
			...base,
			url: 'https://github.com/octocat/hello/pull/5#issuecomment-1'
		});
		const onIssue = commentToActivity({
			...base,
			url: 'https://github.com/octocat/hello/issues/5#issuecomment-2'
		});
		expect(onPr.payload).toMatchObject({ number: 5, on: 'pr' });
		expect(onIssue.payload).toMatchObject({ number: 5, on: 'issue' });
	});

	it('shares one id between a feed comment and the same backfilled comment', () => {
		const url = 'https://github.com/octocat/hello/issues/2#issuecomment-99';
		const feed = mapEvent(
			event('IssueCommentEvent', {
				issue: { title: 'Bug', html_url: 'u', number: 2 },
				comment: { body: 'me too', html_url: url }
			})
		);
		const backfilled = commentToActivity({
			url,
			createdAt: '2026-05-02T00:00:00Z',
			bodyText: 'me too',
			issue: { number: 2, title: 'Bug', repository: { nameWithOwner: 'octocat/hello' } }
		});
		expect(feed?.id).toBe(backfilled.id);
	});

	it('maps a commit comment with no number and a review with its state', () => {
		const commit = commitCommentToActivity({
			url: 'https://github.com/octocat/hello/commit/abc#commitcomment-1',
			createdAt: '2026-05-02T00:00:00Z',
			bodyText: 'nit',
			repository: { nameWithOwner: 'octocat/hello' }
		});
		expect(commit.type).toBe('comment');
		expect(commit.payload).toBeNull();

		const review = reviewToActivity({
			occurredAt: '2026-05-03T00:00:00Z',
			pullRequestReview: {
				url: 'https://github.com/octocat/hello/pull/7#pullrequestreview-1',
				state: 'CHANGES_REQUESTED',
				bodyText: 'please fix',
				pullRequest: { number: 7, title: 'Fix', repository: { nameWithOwner: 'octocat/hello' } }
			}
		});
		expect(review.type).toBe('review');
		expect(review.action).toBe('changes_requested');
		expect(review.id).toContain('pullrequestreview-1');
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

	it('maps GraphQL reactionGroups onto every derived PR row', () => {
		const rows = prToActivities({
			...pr,
			reactionGroups: [
				{ content: 'THUMBS_UP', reactors: { totalCount: 5 } },
				{ content: 'ROCKET', reactors: { totalCount: 0 } }
			]
		});
		expect(rows.every((row) => row.reactions?.['+1'] === 5)).toBe(true);
		expect(rows[0].reactions).toEqual({ '+1': 5 });
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
