import { getUserOverview } from '$lib/server/github/user';
import { getRepoTraffic, getTrafficHistory } from '$lib/server/github/traffic';
import { cached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { logError } from '$lib/errors';
import type { AnalyticsItem, UserAnalytics } from '$lib/types';

// Full traffic for many repos is heavy, so bound the fan-out and the repo count
const MAX_REPOS = 100;
const CONCURRENCY = 5;

// Bump when the stored shape changes, to retire old entries
const key = (login: string) => `user:analytics:1:${login.toLowerCase()}`;

// Pull current traffic for every owned repo, snapshotting it, then read back the
// combined day-by-day history plus the live top paths and referrers
async function fetchAnalytics(login: string): Promise<UserAnalytics> {
	const { ownedRepos } = await getUserOverview(login);
	const source = ownedRepos.filter((repo) => !repo.isFork);
	const targets = source.slice(0, MAX_REPOS);

	const paths: AnalyticsItem[] = [];
	const referrers: AnalyticsItem[] = [];
	await mapLimit(targets, CONCURRENCY, async (repo) => {
		// One repo failing or lacking access never blanks the rest, each is cached alone
		try {
			const traffic = await getRepoTraffic(repo.owner, repo.name);
			if (!traffic.available) return;
			for (const item of traffic.topPaths) paths.push({ ...item, repo: repo.nameWithOwner });
			for (const item of traffic.topReferrers) referrers.push({ ...item, repo: repo.nameWithOwner });
		} catch (caught) {
			logError('analytics-repo', caught);
		}
	});

	const daily = await getTrafficHistory(targets.map((repo) => repo.nameWithOwner));
	const repos = [
		...new Set([
			...daily.map((row) => row.repo),
			...paths.map((item) => item.repo),
			...referrers.map((item) => item.repo)
		])
	].sort();
	return { repos, capped: source.length > targets.length, daily, paths, referrers };
}

// Combined traffic analytics across a user's owned repos, cached and snapshotted
export function getUserAnalytics(login: string): Promise<UserAnalytics> {
	return cached(key(login), () => fetchAnalytics(login));
}
