import { GITHUB_WEB } from '$lib/config';
import type { ActivityEvent } from '$lib/types';

// Raw shapes from the events feed. Fields are optional since the feed sends
// only a thin slice for some types (pull_request lacks title/html_url)
type RawCommit = { message?: string; sha?: string };
type RawSubject = { number: number; title?: string; html_url?: string; merged?: boolean };
type RawIssue = RawSubject & { pull_request?: unknown };
type RawComment = { body?: string; html_url?: string };
type RawReview = { state?: string; html_url?: string; body?: string | null };
type RawRelease = {
	name?: string | null;
	tag_name?: string;
	html_url?: string;
	body?: string | null;
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
};

export type RawEvent = {
	id: string;
	type: string;
	repo: { name: string };
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
	const repo = raw.repo.name;
	const repoUrl = `${GITHUB_WEB}/${repo}`;
	const evtId = `evt:${raw.id}`;
	const base = { createdAt: raw.created_at, repo };
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
				payload: { number: issue.number }
			};
		}
		case 'IssueCommentEvent': {
			const issue = p.issue;
			const comment = p.comment;
			if (!issue || !comment) return null;
			return {
				id: evtId,
				type: 'comment',
				action: 'commented',
				...base,
				title: truncate(issue.title, TITLE) || null,
				body: truncate(comment.body, PREVIEW) || null,
				url: comment.html_url ?? `${repoUrl}/issues/${issue.number}`,
				payload: { number: issue.number, on: issue.pull_request ? 'pr' : 'issue' }
			};
		}
		case 'PullRequestReviewEvent': {
			const review = p.review;
			const pr = p.pull_request;
			if (!review || !pr) return null;
			return {
				id: evtId,
				type: 'review',
				action: review.state?.toLowerCase() ?? 'reviewed',
				...base,
				title: truncate(pr.title, TITLE) || null,
				body: truncate(review.body, PREVIEW) || null,
				url: review.html_url ?? `${repoUrl}/pull/${pr.number}`,
				payload: { number: pr.number }
			};
		}
		case 'PullRequestReviewCommentEvent': {
			const comment = p.comment;
			const pr = p.pull_request;
			if (!comment || !pr) return null;
			return {
				id: evtId,
				type: 'comment',
				action: 'commented',
				...base,
				title: truncate(pr.title, TITLE) || null,
				body: truncate(comment.body, PREVIEW) || null,
				url: comment.html_url ?? `${repoUrl}/pull/${pr.number}`,
				payload: { number: pr.number, on: 'pr' }
			};
		}
		case 'CommitCommentEvent': {
			const comment = p.comment;
			if (!comment) return null;
			return {
				id: evtId,
				type: 'comment',
				action: 'commented',
				...base,
				title: null,
				body: truncate(comment.body, PREVIEW) || null,
				url: comment.html_url ?? repoUrl,
				payload: null
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
				payload: { tag: release.tag_name ?? null }
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
};

// Opened plus the latest terminal state (merged/closed) for a backfilled PR
export function prToActivities(pr: BackfillItem): ActivityEvent[] {
	const repo = pr.repository.nameWithOwner;
	const title = truncate(pr.title, TITLE) || null;
	const row = (action: string, createdAt: string): ActivityEvent => ({
		id: subjectKey('pr', repo, pr.number, action),
		type: 'pr',
		action,
		createdAt,
		repo,
		title,
		body: null,
		url: pr.url,
		payload: { number: pr.number }
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
	const row = (action: string, createdAt: string): ActivityEvent => ({
		id: subjectKey('issue', repo, issue.number, action),
		type: 'issue',
		action,
		createdAt,
		repo,
		title,
		body: null,
		url: issue.url,
		payload: { number: issue.number }
	});
	const out = [row('opened', issue.createdAt)];
	if (issue.closedAt) out.push(row('closed', issue.closedAt));
	return out;
}
