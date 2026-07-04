import type { TaskBucket } from '$lib/types';

export type BucketInfo = { title: string; kind: 'pr' | 'issue'; section: string; empty: string };

// Each bucket's title, route section and empty text, the UI layers icons on top
export const TASK_BUCKET_INFO: Record<TaskBucket, BucketInfo> = {
	reviewPrs: {
		title: 'PRs to review',
		kind: 'pr',
		section: 'prs-review',
		empty: 'No open PRs to review'
	},
	myPrs: {
		title: 'Your PRs',
		kind: 'pr',
		section: 'my-prs',
		empty: 'No open PRs opened by you'
	},
	reviewIssues: {
		title: 'Issues to review',
		kind: 'issue',
		section: 'issues-review',
		empty: 'No open issues to review'
	},
	myIssues: {
		title: 'Your issues',
		kind: 'issue',
		section: 'my-issues',
		empty: 'No open issues opened by you'
	}
};

// Overview layout: PR buckets in the left column, issue buckets in the right
export const TASK_COLUMNS: TaskBucket[][] = [
	['reviewPrs', 'myPrs'],
	['reviewIssues', 'myIssues']
];

export const BUCKET_BY_SECTION: Record<string, TaskBucket> = Object.fromEntries(
	(Object.keys(TASK_BUCKET_INFO) as TaskBucket[]).map((bucket) => [
		TASK_BUCKET_INFO[bucket].section,
		bucket
	])
);
