import type { Person } from './user';

export type IssueLabel = { name: string; color: string };

// PR check rollup and review state, normalised to lowercase tokens, null when absent
export type CheckState = 'success' | 'failure' | 'pending';
export type ReviewDecision = 'approved' | 'changes_requested' | 'review_required';

// One open issue or PR row, shared by every task list. PR-only fields stay null on issues
export type TaskItem = {
	id: string;
	kind: 'pr' | 'issue';
	number: number;
	title: string;
	url: string;
	repo: string;
	state: 'open' | 'closed' | 'merged';
	draft: boolean;
	createdAt: string;
	updatedAt: string;
	author: Person | null;
	assignees: Person[];
	labels: IssueLabel[];
	comments: number;
	reviewDecision: ReviewDecision | null;
	checks: CheckState | null;
	additions: number | null;
	deletions: number | null;
	changedFiles: number | null;
};

// The four task buckets, see TASK_BUCKETS for their titles and routes
export type TaskBucket = 'reviewPrs' | 'myPrs' | 'reviewIssues' | 'myIssues';

// One bucket of items, total is the deduped count we hold, capped when truncated
export type TaskList = { items: TaskItem[]; total: number; capped: boolean };

export type TaskData = {
	login: string;
	isOrg: boolean;
	buckets: Record<TaskBucket, TaskList>;
};
