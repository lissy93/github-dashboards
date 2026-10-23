import { getUserOverview } from '$lib/server/github/user';
import { getRepoTraffic, getTrafficHistory } from '$lib/server/github/traffic';
import { checkpointed } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { logError } from '$lib/utils/errors';
import type { AnalyticsItem, TrafficDay, UserAnalytics } from '$lib/types';

// Full traffic for many repos is heavy, so bound the fan-out and the repo count
const REPOS_PER_SYNC = 12;
const CONCURRENCY = 5;
const TTL = 900;

// Daily history is read live rather than checkpointed, so the chart never lags the snapshots
type Live = Pick<UserAnalytics, 'capped' | 'paths' | 'referrers'>;
type AnalyticsState = Live & { covered: string[]; nextIndex: number; source: string[] };

const key = (login: string) => `user:analytics-state:v2:${login.toLowerCase()}`;

// Dashboard shape, listing every repo that has any traffic
function toAnalytics(daily: TrafficDay[], { capped, paths, referrers }: Live): UserAnalytics {
	const repos = [...new Set([...daily, ...paths, ...referrers].map((item) => item.repo))].sort();
	return { repos, capped, daily, paths, referrers };
}

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
	let paths = (current?.paths ?? []).filter((item) => names.includes(item.repo));
	let referrers = (current?.referrers ?? []).filter((item) => names.includes(item.repo));
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

	return {
		// More repos than one batch covers means the live paths are a rotating sample
		capped: source.length > targets.length,
		paths,
		referrers,
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
	return toAnalytics(await getTrafficHistory(state.source), state);
}

// Traffic analytics for one repo, shaped like UserAnalytics so the same dashboard renders it
export async function getRepoAnalytics(owner: string, name: string): Promise<UserAnalytics> {
	const nameWithOwner = `${owner}/${name}`;
	const tag = (item: Omit<AnalyticsItem, 'repo'>) => ({ ...item, repo: nameWithOwner });
	const traffic = await getRepoTraffic(owner, name);
	const daily = await getTrafficHistory([nameWithOwner]);
	return toAnalytics(daily, {
		capped: false,
		paths: traffic.topPaths.map(tag),
		referrers: traffic.topReferrers.map(tag)
	});
}
