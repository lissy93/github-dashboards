import { buildPunchCard } from '$lib/utils/punch-card';
import { graphql } from '$lib/server/github/client';
import { fetchStatsEndpoint, statsPending } from '$lib/server/github/stats-endpoint';
import { cached } from '$lib/server/cache';
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
			return buildPunchCard(raw);
		},
		TTL
	);
}
