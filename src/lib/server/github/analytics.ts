import { getUserOverview } from '$lib/server/github/user';
import { getRepoTraffic, getTrafficHistory } from '$lib/server/github/traffic';
import { checkpointed, cached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { logError } from '$lib/utils/errors';
import type { AnalyticsItem, UserAnalytics } from '$lib/types';

// Full traffic for many repos is heavy, so bound the fan-out and the repo count
const REPOS_PER_SYNC = 12;
const CONCURRENCY = 5;
const TTL = 900;

type AnalyticsState = {
	data: UserAnalytics;
	covered: string[];
	nextIndex: number;
	source: string[];
};

const key = (login: string) => `user:analytics-state:v1:${login.toLowerCase()}`;
// Refresh a rotating repo batch, preserving successful data from earlier batches
async function syncAnalytics(login: string, current?: AnalyticsState): Promise<AnalyticsState> {
	const { ownedRepos } = await getUserOverview(login);
	const source = ownedRepos.filter((repo) => !repo.isFork);
	const names = source.map((repo) => repo.nameWithOwner);
	const sameSource =
		current?.source.length === names.length &&
		current.source.every((name, index) => name === names[index]);
	const start = sameSource ? current.nextIndex % Math.max(1, source.length) : 0;
	const targets = Array.from(
		{ length: Math.min(REPOS_PER_SYNC, source.length) },
		(_, index) => source[(start + index) % source.length]
	);
	let paths = (current?.data.paths ?? []).filter((item) => names.includes(item.repo));
	let referrers = (current?.data.referrers ?? []).filter((item) => names.includes(item.repo));
	const covered = new Set((current?.covered ?? []).filter((name) => names.includes(name)));
	await mapLimit(targets, CONCURRENCY, async (repo) => {
		try {
			const traffic = await getRepoTraffic(repo.owner, repo.name);
			paths = paths.filter((item) => item.repo !== repo.nameWithOwner);
			referrers = referrers.filter((item) => item.repo !== repo.nameWithOwner);
			covered.add(repo.nameWithOwner);
			if (!traffic.available) return;
			for (const item of traffic.topPaths) paths.push({ ...item, repo: repo.nameWithOwner });
			for (const item of traffic.topReferrers)
				referrers.push({ ...item, repo: repo.nameWithOwner });
		} catch (caught) {
			logError('analytics-repo', caught);
		}
	});

	const daily = await getTrafficHistory(names);
	const repos = [
		...new Set([
			...daily.map((row) => row.repo),
			...paths.map((item) => item.repo),
			...referrers.map((item) => item.repo)
		])
	].sort();
	return {
		data: {
			repos,
			// More repos than one batch covers means the live paths are a rotating sample
			capped: source.length > targets.length,
			daily,
			paths,
			referrers
		},
		covered: [...covered],
		nextIndex: source.length ? (start + targets.length) % source.length : 0,
		source: names
	};
}

// Combined traffic analytics, rotating through repos while serving cached snapshots
export async function getUserAnalytics(login: string): Promise<UserAnalytics> {
	const state = await checkpointed<AnalyticsState>('user-analytics', key(login), TTL, (current) =>
		syncAnalytics(login, current)
	);
	return state.data;
}

const repoKey = (owner: string, name: string) => `repo:analytics:1:${owner}/${name}`.toLowerCase();

// Traffic analytics for a single repo, shaped like UserAnalytics so the dashboard
// component renders it unchanged. Reuses the per-repo traffic cache and snapshots
async function fetchRepoAnalytics(owner: string, name: string): Promise<UserAnalytics> {
	const nameWithOwner = `${owner}/${name}`;
	const traffic = await getRepoTraffic(owner, name);
	const daily = await getTrafficHistory([nameWithOwner]);
	const paths: AnalyticsItem[] = traffic.topPaths.map((item) => ({ ...item, repo: nameWithOwner }));
	const referrers: AnalyticsItem[] = traffic.topReferrers.map((item) => ({
		...item,
		repo: nameWithOwner
	}));
	const repos = daily.length || paths.length || referrers.length ? [nameWithOwner] : [];
	return { repos, capped: false, daily, paths, referrers };
}

export function getRepoAnalytics(owner: string, name: string): Promise<UserAnalytics> {
	return cached(repoKey(owner, name), () => fetchRepoAnalytics(owner, name));
}
