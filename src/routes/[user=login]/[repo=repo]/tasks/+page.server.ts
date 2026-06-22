import { getRepoTasks, isRepoTasksCached } from '$lib/server/github/repo-tasks';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const tasks = settle('repo-tasks', getRepoTasks(params.user, params.repo));
	const ready = await isRepoTasksCached(params.user, params.repo);
	return { tasks: ready ? await tasks : tasks };
};
