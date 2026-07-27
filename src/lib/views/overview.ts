import type {
	UserOverview,
	TaskData,
	ActivityEvent,
	ActivityRhythm,
	UserContributions,
	LanguageUsage,
	RepoLang,
	RepoActivityMonths,
	LoadResult
} from '$lib/types';

export type OverviewResult = LoadResult<UserOverview>;
export type TaskResult = LoadResult<TaskData>;
export type ActivityResult = LoadResult<ActivityEvent[]>;
export type ContributionsResult = LoadResult<UserContributions>;
export type LanguagesResult = LoadResult<LanguageUsage[]>;
export type RepoLanguagesResult = LoadResult<Record<string, RepoLang[]>>;
export type RhythmResult = LoadResult<ActivityRhythm>;
export type LifecycleActivityResult = LoadResult<RepoActivityMonths>;

// Row counts for the overview previews
export const OVERVIEW_TASK_PREVIEW = 5;
export const OVERVIEW_ACTIVITY_PREVIEW = 24;
export const TASKS_SUMMARY_PREVIEW = 6;

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
