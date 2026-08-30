import type { TaskBucket } from '$lib/types';

// mine marks the lists of the user's own authored work, the rest are review queues
export type BucketInfo = {
	title: string;
	kind: 'pr' | 'issue';
	section: string;
	empty: string;
	mine: boolean;
};

// Each bucket's title, route section and empty text, the UI layers icons on top
export const TASK_BUCKET_INFO: Record<TaskBucket, BucketInfo> = {
	reviewPrs: {
		title: 'PRs to review',
		kind: 'pr',
		section: 'prs-review',
		empty: 'No open PRs to review',
		mine: false
	},
	myPrs: {
		title: 'PRs submitted',
		kind: 'pr',
		section: 'my-prs',
		empty: 'No open PRs submitted',
		mine: true
	},
	reviewIssues: {
		title: 'Issues to review',
		kind: 'issue',
		section: 'issues-review',
		empty: 'No open issues to review',
		mine: false
	},
	myIssues: {
		title: 'Issues opened',
		kind: 'issue',
		section: 'my-issues',
		empty: 'No open issues opened',
		mine: true
	}
};

// Overview layout: PR buckets in the left column, issue buckets in the right
export const TASK_COLUMNS: TaskBucket[][] = [
	['reviewPrs', 'myPrs'],
	['reviewIssues', 'myIssues']
];

// Review queues only mean something to the profile owner, authored lists never apply to an org
export const showsBucket = (bucket: TaskBucket, isOwner: boolean, isOrg: boolean): boolean =>
	TASK_BUCKET_INFO[bucket].mine ? !isOrg : isOwner || isOrg;

// Overview pair: your own profile gets the review queues, anyone else gets the authored work
export const overviewBuckets = (isOwner: boolean, isOrg: boolean): TaskBucket[] =>
	isOwner || isOrg ? ['reviewPrs', 'reviewIssues'] : ['myPrs', 'myIssues'];

export const BUCKET_BY_SECTION: Record<string, TaskBucket> = Object.fromEntries(
	(Object.keys(TASK_BUCKET_INFO) as TaskBucket[]).map((bucket) => [
		TASK_BUCKET_INFO[bucket].section,
		bucket
	])
);
