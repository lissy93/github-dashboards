import type { UserOverview, TaskData, ActivityEvent } from '$lib/types';
import type { DisplayError } from '$lib/errors';

// A settled load, errors travel as data so their message survives streaming
export type LoadResult<T> = { ok: true; data: T } | { ok: false; error: DisplayError };

export type OverviewResult = LoadResult<UserOverview>;
export type TaskResult = LoadResult<TaskData>;
export type ActivityResult = LoadResult<ActivityEvent[]>;

// Trim each task bucket to a short preview while keeping its real total
export function previewBuckets(data: TaskData, limit: number): TaskData {
	const buckets = Object.fromEntries(
		Object.entries(data.buckets).map(([bucket, list]) => [
			bucket,
			{ ...list, items: list.items.slice(0, limit) }
		])
	) as TaskData['buckets'];
	return { ...data, buckets };
}
