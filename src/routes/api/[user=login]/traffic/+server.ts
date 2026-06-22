import { json } from '@sveltejs/kit';
import { getUserOverview } from '$lib/server/github/user';
import { canSeeTraffic, getRepoTrafficSummary } from '$lib/server/github/traffic';
import { mapLimit } from '$lib/server/concurrency';
import { logError } from '$lib/errors';
import type { RequestHandler } from './$types';

const MAX_REPOS = 150;
const CONCURRENCY = 5;

export type TrafficMap = Record<string, { views: number; uniques: number; clones: number }>;

// Per-repo traffic for the owner's repos, used to enable the Traffic sort.
// Gated to the owner since traffic is private, and bounded to stay within limits.
export const GET: RequestHandler = async ({ params, setHeaders, locals }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!canSeeTraffic(params.user, locals.user?.login))
		return json({ available: false, repos: {} as TrafficMap });

	try {
		const { ownedRepos } = await getUserOverview(params.user);
		const targets = ownedRepos.filter((repo) => !repo.isFork).slice(0, MAX_REPOS);

		const repos: TrafficMap = {};
		await mapLimit(targets, CONCURRENCY, async (repo) => {
			// Don't let one repo blank the rest, each is cached on its own anyway
			try {
				const summary = await getRepoTrafficSummary(repo.owner, repo.name);
				if (summary.available)
					repos[repo.nameWithOwner] = {
						views: summary.views.count,
						uniques: summary.views.uniques,
						clones: summary.clones.count
					};
			} catch (caught) {
				logError('traffic-endpoint-repo', caught);
			}
		});

		return json({ available: true, repos });
	} catch (caught) {
		logError('traffic-endpoint', caught);
		return json({ available: false, repos: {} as TrafficMap });
	}
};
