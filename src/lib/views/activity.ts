import type { SortFilterConfig, View } from '$lib/components/filter/sort-filter';
import { ACTIVITY_TYPE_OPTIONS } from '$lib/components/activity/activity-config';
import type { ActivityEvent } from '$lib/types';

// Filter + search config for the feed
export function activityFilterConfig(): SortFilterConfig<ActivityEvent> {
	return {
		search: (event) => `${event.repo} ${event.title ?? ''}`,
		sorts: [{ key: 'recent', label: 'Most recent', value: () => 0 }],
		filters: [{ key: 'type', label: 'Types', options: ACTIVITY_TYPE_OPTIONS, test: () => true }]
	};
}

// Translate the shared View into activity API query params
export function activityQuery(view: View): { type: string; q: string; dir: string } {
	return { type: view.filters.type ?? '', q: view.search.trim(), dir: view.dir };
}

// Build the activity API url for one page request, carrying filters and cursor.
// Pass repo to hit the repo-scoped feed instead of the whole user timeline
export function activityUrl(
	user: string,
	view: View,
	cursor: string | null,
	repo?: string
): string {
	const params = new URLSearchParams();
	const { type, q, dir } = activityQuery(view);
	if (cursor) params.set('cursor', cursor);
	if (type) params.set('type', type);
	if (q) params.set('q', q);
	if (dir) params.set('dir', dir);
	const base = repo ? `/api/${user}/${repo}/activity` : `/api/${user}/activity`;
	return `${base}?${params}`;
}
