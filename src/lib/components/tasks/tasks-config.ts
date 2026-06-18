import type { Component } from 'svelte';
import {
	GitPullRequest,
	GitPullRequestArrow,
	GitPullRequestDraft,
	CircleDot,
	CircleDotDashed,
	CircleCheck,
	CircleX,
	CircleDashed,
	Check,
	X,
	Clock
} from '@lucide/svelte';
import type { CheckState, ReviewDecision, TaskBucket, TaskItem } from '$lib/types';

type IconComponent = Component<{ size?: number | string; class?: string }>;

export type BucketMeta = {
	title: string;
	kind: 'pr' | 'issue';
	section: string;
	icon: IconComponent;
	empty: string;
};

// Define each bucket's title, route and icon once, reused on every task surface
export const TASK_BUCKETS: Record<TaskBucket, BucketMeta> = {
	reviewPrs: {
		title: 'PRs to review',
		kind: 'pr',
		section: 'prs-review',
		icon: GitPullRequest,
		empty: 'No open PRs to review'
	},
	myPrs: {
		title: 'Your PRs',
		kind: 'pr',
		section: 'my-prs',
		icon: GitPullRequestArrow,
		empty: 'No open PRs opened by you'
	},
	reviewIssues: {
		title: 'Issues to review',
		kind: 'issue',
		section: 'issues-review',
		icon: CircleDot,
		empty: 'No open issues to review'
	},
	myIssues: {
		title: 'Your issues',
		kind: 'issue',
		section: 'my-issues',
		icon: CircleDotDashed,
		empty: 'No open issues opened by you'
	}
};

// Overview layout: PR buckets in the left column, issue buckets in the right
export const TASK_COLUMNS: TaskBucket[][] = [
	['reviewPrs', 'myPrs'],
	['reviewIssues', 'myIssues']
];

export const BUCKET_BY_SECTION: Record<string, TaskBucket> = Object.fromEntries(
	(Object.keys(TASK_BUCKETS) as TaskBucket[]).map((bucket) => [
		TASK_BUCKETS[bucket].section,
		bucket
	])
);

// State glyph for a row, a hollow draft icon when the PR is still a draft
export function itemIcon(item: TaskItem): IconComponent {
	if (item.kind === 'pr') return item.draft ? GitPullRequestDraft : GitPullRequest;
	return CircleDot;
}

export const itemColor = (item: TaskItem): string => (item.draft ? 'text-draft' : 'text-open');

type StatusMeta = { icon: IconComponent; color: string; label: string };

// Check rollup and review states, each with its own glyph and result colour
export const CHECK_META: Record<CheckState, StatusMeta> = {
	success: { icon: CircleCheck, color: 'text-success', label: 'Checks passing' },
	failure: { icon: CircleX, color: 'text-danger', label: 'Checks failing' },
	pending: { icon: CircleDashed, color: 'text-warning', label: 'Checks running' }
};

export const REVIEW_META: Record<ReviewDecision, StatusMeta> = {
	approved: { icon: Check, color: 'text-success', label: 'Approved' },
	changes_requested: { icon: X, color: 'text-danger', label: 'Changes requested' },
	review_required: { icon: Clock, color: 'text-muted-foreground', label: 'Review required' }
};
