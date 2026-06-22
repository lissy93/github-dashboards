import { graphql } from '$lib/server/github/client';
import { fetchStatsEndpoint, statsPending } from '$lib/server/github/stats-endpoint';
import { cached, isCached } from '$lib/server/cache';
import { toMondayFirst } from '$lib/datetime';
import type { ActivityRhythm } from '$lib/types';

// Stats move slowly and the /stats endpoints are costly to warm, so cache them a day
const TTL = 86400;
// Window for the recent-commits KPI and the one before it, for a change figure
const RECENT_DAYS = 28;

const repoName = (owner: string, name: string) => `${owner}/${name}`.toLowerCase();

// ---- Recent commits -------------------------------------------------------
// A reliable headline figure from the commit history, since GitHub's commit_activity
// stats endpoint often never finishes computing for large repos

export type RepoRecentCommits = { recent: number; prior: number };

const RECENT_QUERY = `
	query RecentCommits($owner: String!, $name: String!, $since: GitTimestamp!, $prior: GitTimestamp!) {
		repository(owner: $owner, name: $name) {
			defaultBranchRef {
				target {
					... on Commit {
						recent: history(since: $since) { totalCount }
						prior: history(since: $prior, until: $since) { totalCount }
					}
				}
			}
		}
	}
`;

type RecentRaw = {
	repository: {
		defaultBranchRef: {
			target: { recent?: { totalCount: number }; prior?: { totalCount: number } } | null;
		} | null;
	} | null;
};

export const isRepoRecentCommitsCached = (owner: string, name: string) =>
	isCached(`repo:recent-commits:v1:${repoName(owner, name)}`);

// Commits in the last window and the window before it, for the strip's change figure
export function getRepoRecentCommits(owner: string, name: string): Promise<RepoRecentCommits> {
	return cached(
		`repo:recent-commits:v1:${repoName(owner, name)}`,
		async () => {
			const since = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString();
			const prior = new Date(Date.now() - 2 * RECENT_DAYS * 86400000).toISOString();
			const { repository } = await graphql<RecentRaw>(RECENT_QUERY, { owner, name, since, prior });
			const target = repository?.defaultBranchRef?.target;
			return { recent: target?.recent?.totalCount ?? 0, prior: target?.prior?.totalCount ?? 0 };
		},
		TTL
	);
}

// ---- Punch card -----------------------------------------------------------
// When commits land, as a weekday-by-hour grid. All-time, so cache only

export const isRepoPunchCardCached = (owner: string, name: string) =>
	isCached(`repo:punch-card:v1:${repoName(owner, name)}`);

export function getRepoPunchCard(owner: string, name: string): Promise<ActivityRhythm> {
	const repo = repoName(owner, name);
	const key = `repo:punch-card:v1:${repo}`;
	return cached(
		key,
		async () => {
			const raw = await fetchStatsEndpoint<[number, number, number]>(
				`/repos/${owner}/${name}/stats/punch_card`,
				`punch card for ${repo}`
			);
			if (raw === null)
				statsPending(key, () => getRepoPunchCard(owner, name), `punch card for ${repo}`);
			const punch = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
			let total = 0;
			// GitHub's weekday is Sunday-first, shift so Monday leads to match the chart
			for (const [day, hour, commits] of raw) {
				punch[toMondayFirst(day)][hour] += commits;
				total += commits;
			}
			let peak: ActivityRhythm['peak'] = null;
			punch.forEach((row, weekday) =>
				row.forEach((count, hour) => {
					if (count > 0 && (!peak || count > peak.count)) peak = { weekday, hour, count };
				})
			);
			return { total, punch, peak };
		},
		TTL
	);
}
