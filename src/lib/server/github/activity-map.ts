import { GITHUB_WEB } from '$lib/config';
import { REACTION_KEYS } from '$lib/reactions';
import type { ActivityEvent, Reactions } from '$lib/types';

// GraphQL reactionGroups use enum content names, mapped back to the canonical keys
const GQL_REACTION: Record<string, string> = {
	THUMBS_UP: '+1',
	THUMBS_DOWN: '-1',
	LAUGH: 'laugh',
	HOORAY: 'hooray',
	CONFUSED: 'confused',
	HEART: 'heart',
	ROCKET: 'rocket',
	EYES: 'eyes'
};

type RawReactions = Record<string, number | string | undefined>;
type ReactionGroup = { content?: string; reactors?: { totalCount?: number } };

// Keep only non-zero counts, in a fixed order, or null when nothing reacted
function clean(counts: Record<string, number>): Reactions | null {
	const out: Reactions = {};
	for (const key of REACTION_KEYS) if (counts[key] > 0) out[key] = counts[key];
	return Object.keys(out).length ? out : null;
}

// Normalise a REST reactions summary (issue/comment/release) to canonical keys
function reactionsFromRest(raw: RawReactions | undefined): Reactions | null {
	if (!raw) return null;
	const counts: Record<string, number> = {};
	for (const key of REACTION_KEYS) counts[key] = Number(raw[key]) || 0;
	return clean(counts);
}

// Normalise GraphQL reactionGroups to canonical keys
export function reactionsFromGroups(groups: ReactionGroup[] | undefined): Reactions | null {
	if (!groups) return null;
	const counts: Record<string, number> = {};
	for (const group of groups) {
		const key = GQL_REACTION[group.content ?? ''];
		if (key) counts[key] = group.reactors?.totalCount ?? 0;
	}
	return clean(counts);
}

// Raw shapes from the events feed. Fields are optional since the feed sends
// only a thin slice for some types (pull_request lacks title/html_url)
type RawCommit = { message?: string; sha?: string };
type RawSubject = { number: number; title?: string; html_url?: string; merged?: boolean };
type RawIssue = RawSubject & { pull_request?: unknown; reactions?: RawReactions };
type RawComment = { body?: string; html_url?: string; reactions?: RawReactions };
type RawReview = { state?: string; html_url?: string; body?: string | null };
type RawRelease = {
	name?: string | null;
	tag_name?: string;
	html_url?: string;
	body?: string | null;
	reactions?: RawReactions;
};
type RawForkee = { full_name?: string; html_url?: string };
type RawPage = { page_name?: string; title?: string; html_url?: string; action?: string };

type RawPayload = {
	action?: string;
	ref?: string | null;
	ref_type?: string;
	size?: number;
	commits?: RawCommit[];
	pull_request?: RawSubject;
	issue?: RawIssue;
	comment?: RawComment;
	review?: RawReview;
	release?: RawRelease;
	forkee?: RawForkee;
	member?: { login: string };
	pages?: RawPage[];
	sponsorship?: { sponsorable?: { login?: string }; tier?: { name?: string } };
};

export type RawEvent = {
	id: string;
	type: string;
	repo?: { name: string };
	payload: RawPayload;
	created_at: string;
};

const TITLE = 140;
const PREVIEW = 200;
// Issue/PR actions worth a timeline row, the rest (labeled, assigned, …) are noise
const PR_ACTIONS = new Set(['opened', 'closed', 'reopened', 'merged']);
const ISSUE_ACTIONS = new Set(['opened', 'closed', 'reopened']);

// Repo + number keys a PR/issue action the same way from either source, so the
// events feed and the GraphQL backfill dedupe (the feed omits the node id)
const subjectKey = (type: 'pr' | 'issue', repo: string, number: number, action: string) =>
	`${type}:${repo}#${number}:${action}`;

// Comments and reviews key on their stable html url, shared by both the events
// feed and the backfill, so the same item from either source dedupes
const commentKey = (url: string) => `comment:${url}`;
const reviewKey = (url: string) => `review:${url}`;

// Collapse whitespace and clip to a length, with an ellipsis when cut.
// Tolerant of missing text since events-feed payloads omit optional fields
export function truncate(text: string | null | undefined, max: number): string {
	const clean = (text ?? '').replace(/\s+/g, ' ').trim();
	return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// Opaque keyset cursor over (createdAt, id), the tiebreak that makes paging stable
export function encodeCursor(event: { createdAt: string; id: string }): string {
	return Buffer.from(`${event.createdAt}|${event.id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
	const decoded = Buffer.from(cursor, 'base64url').toString();
	const split = decoded.indexOf('|');
	if (split < 1) return null;
	const createdAt = decoded.slice(0, split);
	const id = decoded.slice(split + 1);
	return id ? { createdAt, id } : null;
}

// Map one raw events-feed event to a normalised row, or null to skip it
export function mapEvent(raw: RawEvent): ActivityEvent | null {
	// Sponsorship events carry no repo, so fall back to an empty owner
	const repo = raw.repo?.name ?? '';
	const repoUrl = `${GITHUB_WEB}/${repo}`;
	const evtId = `evt:${raw.id}`;
	const base = { createdAt: raw.created_at, repo, reactions: null };
	const p = raw.payload;

	switch (raw.type) {
		case 'PushEvent': {
			const head = p.commits?.at(-1);
			const branch = p.ref?.replace('refs/heads/', '') ?? '';
			return {
				id: evtId,
				type: 'push',
				action: 'pushed',
				...base,
				title: head?.message ? truncate(head.message.split('\n')[0], 120) : null,
				body: null,
				url: head?.sha ? `${repoUrl}/commit/${head.sha}` : `${repoUrl}/commits/${branch}`,
				payload: { count: p.size ?? p.commits?.length ?? 0, branch }
			};
		}
		case 'PullRequestEvent': {
			const pr = p.pull_request;
			const action = p.action === 'closed' && pr?.merged ? 'merged' : (p.action ?? 'opened');
			if (!pr || !PR_ACTIONS.has(action)) return null;
			return {
				id: subjectKey('pr', repo, pr.number, action),
				type: 'pr',
				action,
				...base,
				title: truncate(pr.title, TITLE) || null,
				body: null,
				url: pr.html_url ?? `${repoUrl}/pull/${pr.number}`,
				payload: { number: pr.number }
			};
		}
		case 'IssuesEvent': {
			const issue = p.issue;
			const action = p.action ?? 'opened';
			if (!issue || !ISSUE_ACTIONS.has(action)) return null;
			return {
				id: subjectKey('issue', repo, issue.number, action),
				type: 'issue',
				action,
				...base,
				title: truncate(issue.title, TITLE) || null,
				body: null,
				url: issue.html_url ?? `${repoUrl}/issues/${issue.number}`,
				payload: { number: issue.number },
				reactions: reactionsFromRest(issue.reactions)
			};
		}
		case 'IssueCommentEvent': {
			const issue = p.issue;
			const comment = p.comment;
			if (!issue || !comment) return null;
			const url = comment.html_url ?? `${repoUrl}/issues/${issue.number}`;
			return {
				id: commentKey(url),
				type: 'comment',
				action: 'commented',
				...base,
				title: truncate(issue.title, TITLE) || null,
				body: truncate(comment.body, PREVIEW) || null,
				url,
				payload: { number: issue.number, on: issue.pull_request ? 'pr' : 'issue' },
				reactions: reactionsFromRest(comment.reactions)
			};
		}
		case 'PullRequestReviewEvent': {
			const review = p.review;
			const pr = p.pull_request;
			if (!review || !pr) return null;
			const url = review.html_url ?? `${repoUrl}/pull/${pr.number}`;
			return {
				id: reviewKey(url),
				type: 'review',
				action: review.state?.toLowerCase() ?? 'reviewed',
				...base,
				title: truncate(pr.title, TITLE) || null,
				body: truncate(review.body, PREVIEW) || null,
				url,
				payload: { number: pr.number }
			};
		}
		case 'PullRequestReviewThreadEvent': {
			const pr = p.pull_request;
			if (!pr) return null;
			return {
				id: evtId,
				type: 'review',
				action: p.action ?? 'resolved',
				...base,
				title: truncate(pr.title, TITLE) || null,
				body: null,
				url: pr.html_url ?? `${repoUrl}/pull/${pr.number}`,
				payload: { number: pr.number }
			};
		}
		case 'PullRequestReviewCommentEvent': {
			const comment = p.comment;
			const pr = p.pull_request;
			if (!comment || !pr) return null;
			const url = comment.html_url ?? `${repoUrl}/pull/${pr.number}`;
			return {
				id: commentKey(url),
				type: 'comment',
				action: 'commented',
				...base,
				title: truncate(pr.title, TITLE) || null,
				body: truncate(comment.body, PREVIEW) || null,
				url,
				payload: { number: pr.number, on: 'pr' },
				reactions: reactionsFromRest(comment.reactions)
			};
		}
		case 'CommitCommentEvent': {
			const comment = p.comment;
			if (!comment) return null;
			const url = comment.html_url ?? repoUrl;
			return {
				id: commentKey(url),
				type: 'comment',
				action: 'commented',
				...base,
				title: null,
				body: truncate(comment.body, PREVIEW) || null,
				url,
				payload: null,
				reactions: reactionsFromRest(comment.reactions)
			};
		}
		case 'ReleaseEvent': {
			const release = p.release;
			if (!release) return null;
			return {
				id: evtId,
				type: 'release',
				action: p.action ?? 'published',
				...base,
				title: release.name || release.tag_name || null,
				body: truncate(release.body, PREVIEW) || null,
				url: release.html_url ?? `${repoUrl}/releases`,
				payload: { tag: release.tag_name ?? null },
				reactions: reactionsFromRest(release.reactions)
			};
		}
		case 'CreateEvent':
			return {
				id: evtId,
				type: 'create',
				action: 'created',
				...base,
				title: p.ref ?? repo,
				body: null,
				url: p.ref && p.ref_type !== 'repository' ? `${repoUrl}/tree/${p.ref}` : repoUrl,
				payload: { refType: p.ref_type ?? 'repository', ref: p.ref ?? null }
			};
		case 'DeleteEvent':
			return {
				id: evtId,
				type: 'delete',
				action: 'deleted',
				...base,
				title: p.ref ?? null,
				body: null,
				url: repoUrl,
				payload: { refType: p.ref_type ?? null, ref: p.ref ?? null }
			};
		case 'ForkEvent':
			return {
				id: evtId,
				type: 'fork',
				action: 'forked',
				...base,
				title: p.forkee?.full_name ?? repo,
				body: null,
				url: p.forkee?.html_url ?? repoUrl,
				payload: null
			};
		case 'WatchEvent':
			return {
				id: evtId,
				type: 'star',
				action: 'starred',
				...base,
				title: null,
				body: null,
				url: repoUrl,
				payload: null
			};
		case 'PublicEvent':
			return {
				id: evtId,
				type: 'public',
				action: 'made public',
				...base,
				title: null,
				body: null,
				url: repoUrl,
				payload: null
			};
		case 'MemberEvent':
			return {
				id: evtId,
				type: 'member',
				action: p.action ?? 'added',
				...base,
				title: p.member?.login ?? null,
				body: null,
				url: repoUrl,
				payload: null
			};
		case 'GollumEvent': {
			const page = p.pages?.[0];
			return {
				id: evtId,
				type: 'wiki',
				action: page?.action ?? 'edited',
				...base,
				title: page?.title ?? page?.page_name ?? null,
				body: null,
				url: page?.html_url ?? `${repoUrl}/wiki`,
				payload: null
			};
		}
		case 'SponsorshipEvent': {
			const login = p.sponsorship?.sponsorable?.login;
			if (!login) return null;
			return {
				id: evtId,
				type: 'sponsor',
				action: p.action ?? 'created',
				...base,
				repo: login,
				title: p.sponsorship?.tier?.name ?? null,
				body: null,
				url: `${GITHUB_WEB}/${login}`,
				payload: null
			};
		}
		default:
			return null;
	}
}

// Backfilled PR/issue shapes from GraphQL, enough to derive timeline rows
export type BackfillItem = {
	number: number;
	title: string;
	url: string;
	createdAt: string;
	closedAt: string | null;
	mergedAt?: string | null;
	repository: { nameWithOwner: string };
	reactionGroups?: ReactionGroup[];
};

// Opened plus the latest terminal state (merged/closed) for a backfilled PR
export function prToActivities(pr: BackfillItem): ActivityEvent[] {
	const repo = pr.repository.nameWithOwner;
	const title = truncate(pr.title, TITLE) || null;
	const reactions = reactionsFromGroups(pr.reactionGroups);
	const row = (action: string, createdAt: string): ActivityEvent => ({
		id: subjectKey('pr', repo, pr.number, action),
		type: 'pr',
		action,
		createdAt,
		repo,
		title,
		body: null,
		url: pr.url,
		payload: { number: pr.number },
		reactions
	});
	const out = [row('opened', pr.createdAt)];
	if (pr.mergedAt) out.push(row('merged', pr.mergedAt));
	else if (pr.closedAt) out.push(row('closed', pr.closedAt));
	return out;
}

// Opened plus closed (when closed) for a backfilled issue
export function issueToActivities(issue: BackfillItem): ActivityEvent[] {
	const repo = issue.repository.nameWithOwner;
	const title = truncate(issue.title, TITLE) || null;
	const reactions = reactionsFromGroups(issue.reactionGroups);
	const row = (action: string, createdAt: string): ActivityEvent => ({
		id: subjectKey('issue', repo, issue.number, action),
		type: 'issue',
		action,
		createdAt,
		repo,
		title,
		body: null,
		url: issue.url,
		payload: { number: issue.number },
		reactions
	});
	const out = [row('opened', issue.createdAt)];
	if (issue.closedAt) out.push(row('closed', issue.closedAt));
	return out;
}

// Discussions are absent from the events feed, so they come from GraphQL only
export type DiscussionItem = {
	number: number;
	title: string;
	url: string;
	createdAt: string;
	repository: { nameWithOwner: string };
	reactionGroups?: ReactionGroup[];
};

export type DiscussionCommentItem = {
	url: string;
	createdAt: string;
	bodyText?: string;
	discussion: { number: number; title?: string; repository: { nameWithOwner: string } };
	reactionGroups?: ReactionGroup[];
};

// One row for an authored discussion
export function discussionToActivity(discussion: DiscussionItem): ActivityEvent {
	const repo = discussion.repository.nameWithOwner;
	return {
		id: `disc:${repo}#${discussion.number}`,
		type: 'discussion',
		action: 'created',
		createdAt: discussion.createdAt,
		repo,
		title: truncate(discussion.title, TITLE) || null,
		body: null,
		url: discussion.url,
		payload: { number: discussion.number },
		reactions: reactionsFromGroups(discussion.reactionGroups)
	};
}

// One row for an authored discussion comment, keyed by its unique url
export function discussionCommentToActivity(comment: DiscussionCommentItem): ActivityEvent {
	const repo = comment.discussion.repository.nameWithOwner;
	return {
		id: `disc-comment:${comment.url}`,
		type: 'comment',
		action: 'commented',
		createdAt: comment.createdAt,
		repo,
		title: truncate(comment.discussion.title, TITLE) || null,
		body: truncate(comment.bodyText, PREVIEW) || null,
		url: comment.url,
		payload: { number: comment.discussion.number, on: 'discussion' },
		reactions: reactionsFromGroups(comment.reactionGroups)
	};
}

// Backfilled issue/PR conversation comments, keyed on url to dedupe with the feed
export type CommentItem = {
	url: string;
	createdAt: string;
	bodyText?: string;
	issue: { number: number; title?: string; repository: { nameWithOwner: string } };
	reactionGroups?: ReactionGroup[];
};

export type CommitCommentItem = {
	url: string;
	createdAt: string;
	bodyText?: string;
	repository: { nameWithOwner: string };
	reactionGroups?: ReactionGroup[];
};

export type ReviewItem = {
	occurredAt: string;
	pullRequestReview: {
		url: string;
		state?: string;
		bodyText?: string;
		pullRequest: { number: number; title?: string; repository: { nameWithOwner: string } };
	};
};

// One row for an authored comment, the url tells a PR thread from an issue
export function commentToActivity(comment: CommentItem): ActivityEvent {
	return {
		id: commentKey(comment.url),
		type: 'comment',
		action: 'commented',
		createdAt: comment.createdAt,
		repo: comment.issue.repository.nameWithOwner,
		title: truncate(comment.issue.title, TITLE) || null,
		body: truncate(comment.bodyText, PREVIEW) || null,
		url: comment.url,
		payload: { number: comment.issue.number, on: comment.url.includes('/pull/') ? 'pr' : 'issue' },
		reactions: reactionsFromGroups(comment.reactionGroups)
	};
}

// One row for an authored commit comment, which has no issue or PR number
export function commitCommentToActivity(comment: CommitCommentItem): ActivityEvent {
	return {
		id: commentKey(comment.url),
		type: 'comment',
		action: 'commented',
		createdAt: comment.createdAt,
		repo: comment.repository.nameWithOwner,
		title: null,
		body: truncate(comment.bodyText, PREVIEW) || null,
		url: comment.url,
		payload: null,
		reactions: reactionsFromGroups(comment.reactionGroups)
	};
}

// One row for a submitted PR review, keyed on url to dedupe with the feed
export function reviewToActivity(item: ReviewItem): ActivityEvent {
	const review = item.pullRequestReview;
	const pr = review.pullRequest;
	return {
		id: reviewKey(review.url),
		type: 'review',
		action: review.state?.toLowerCase() ?? 'reviewed',
		createdAt: item.occurredAt,
		repo: pr.repository.nameWithOwner,
		title: truncate(pr.title, TITLE) || null,
		body: truncate(review.bodyText, PREVIEW) || null,
		url: review.url,
		payload: { number: pr.number },
		reactions: null
	};
}
