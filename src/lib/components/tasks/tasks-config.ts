import type { Component } from 'svelte';
import {
	GitPullRequest,
	GitPullRequestArrow,
	GitPullRequestDraft,
	GitPullRequestClosed,
	GitMerge,
	CircleDot,
	CircleDotDashed,
	CircleCheck,
	CircleSlash,
	CircleX,
	CircleDashed,
	Check,
	X,
	Clock
} from '@lucide/svelte';
import { TASK_BUCKET_INFO, type BucketInfo } from '$lib/config/tasks';
import type { CheckState, ReviewDecision, TaskBucket, TaskItem } from '$lib/types';

type IconComponent = Component<{ size?: number | string; class?: string }>;

export type BucketMeta = BucketInfo & { icon: IconComponent };

const BUCKET_ICONS: Record<TaskBucket, IconComponent> = {
	reviewPrs: GitPullRequest,
	myPrs: GitPullRequestArrow,
	reviewIssues: CircleDot,
	myIssues: CircleDotDashed
};

// Each bucket's shared info plus its icon, reused on every task surface
export const TASK_BUCKETS = Object.fromEntries(
	(Object.keys(TASK_BUCKET_INFO) as TaskBucket[]).map((bucket) => [
		bucket,
		{ ...TASK_BUCKET_INFO[bucket], icon: BUCKET_ICONS[bucket] }
	])
) as Record<TaskBucket, BucketMeta>;

// State glyph for a row, reflecting merged, closed, draft and open work
export function itemIcon(item: TaskItem): IconComponent {
	if (item.kind === 'pr') {
		if (item.state === 'merged') return GitMerge;
		if (item.state === 'closed') return GitPullRequestClosed;
		return item.draft ? GitPullRequestDraft : GitPullRequest;
	}
	return item.state === 'closed' ? CircleSlash : CircleDot;
}

export function itemColor(item: TaskItem): string {
	if (item.state === 'merged') return 'text-merged';
	if (item.state === 'closed') return 'text-closed';
	return item.draft ? 'text-draft' : 'text-open';
}

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
