import { getTaskData, isTaskReady } from '$lib/server/github/tasks';
import { logError, toDisplayError } from '$lib/errors';
import type { TaskData } from '$lib/types';
import type { PageServerLoad } from './$types';

export type TaskResult =
	| { ok: true; data: TaskData }
	| { ok: false; error: { title: string; message: string } };

// The overview only previews each bucket, so ship a few rows but keep real totals
const PREVIEW = 6;
function toPreview(data: TaskData): TaskData {
	const buckets = Object.fromEntries(
		Object.entries(data.buckets).map(([bucket, list]) => [
			bucket,
			{ ...list, items: list.items.slice(0, PREVIEW) }
		])
	) as TaskData['buckets'];
	return { ...data, buckets };
}

export const load: PageServerLoad = async ({ params }) => {
	// Refresh from GitHub best-effort, falling back to a display error if it throws
	const result: Promise<TaskResult> = getTaskData(params.user)
		.then((data) => ({ ok: true as const, data: toPreview(data) }))
		.catch((caught) => {
			logError('task', caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});

	// Render inline once seeded for SEO, stream only the cold first build
	const ready = await isTaskReady(params.user);
	return { user: params.user, result: ready ? await result : result };
};
