import { json } from '@sveltejs/kit';
import { getRepoCommitPage } from '$lib/server/github/repo-commits';
import { requireRepo } from '$lib/server/github/repo';
import { apiError } from '$lib/server/response';
import type { RequestHandler } from './$types';

// One older page of commit history for the graph's load-more, scoped to one branch.
// Gated through requireRepo so private history stays visible only to the owner
export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		await requireRepo(params.user, params.repo, locals.user?.login);
		const branch = url.searchParams.get('branch') ?? undefined;
		const cursor = url.searchParams.get('cursor') ?? undefined;
		return json(await getRepoCommitPage(params.user, params.repo, branch, cursor));
	} catch (caught) {
		return apiError('commits-endpoint', caught);
	}
};
