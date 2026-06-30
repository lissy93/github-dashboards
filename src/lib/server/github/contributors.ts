import { restResponse } from '$lib/server/github/client';
import { fetchStatsEndpoint, statsPending } from '$lib/server/github/stats-endpoint';
import { enrichOwnedRepos } from '$lib/server/github/enrich';
import { cached, isCached } from '$lib/server/cache';
import { AppError } from '$lib/errors';
import type { OwnedRepoData } from '$lib/types';

const DAY = 86400;

// Compact activity sparkline, the repo's weeks folded into this many buckets
const SPARK_BUCKETS = 24;

// Contributor count from a per_page=1 listing: the last page number is the total
export function parseContributorCount(linkHeader: string | null, bodyLength: number): number {
	const last = linkHeader?.match(/[?&]page=(\d+)>;\s*rel="last"/);
	return last ? Number(last[1]) : bodyLength;
}

async function fetchCount(owner: string, repo: string): Promise<number> {
	try {
		const res = await restResponse(`/repos/${owner}/${repo}/contributors?per_page=1&anon=1`);
		if (!res || res.status === 204) return 0;
		const body = (await res.json()) as unknown[];
		return parseContributorCount(res.headers.get('link'), body.length);
	} catch (error) {
		// An empty or restricted repo has no visible contributors
		if (error instanceof AppError && error.code === 'forbidden') return 0;
		throw error;
	}
}

// Contributor counts for the owned repos, cached as one entry with a bounded refresh
export function getOwnedContributors(login: string): Promise<OwnedRepoData<number>> {
	return enrichOwnedRepos('contributors:v2', login, DAY, async (repo) => {
		const count = await fetchCount(repo.owner, repo.name);
		return count > 0 ? count : null;
	});
}

export type ContributorRow = {
	login: string;
	avatarUrl: string;
	htmlUrl: string;
	contributions: number;
	additions: number;
	deletions: number;
	firstCommit: string | null;
	lastCommit: string | null;
	spark: number[];
};
// One week of repo-wide code churn, additions and deletions across all authors
export type WeekChurn = { week: string; additions: number; deletions: number };
export type RepoContributors = {
	contributors: ContributorRow[];
	total: number;
	sampled: boolean;
	weekly: WeekChurn[];
};

type StatWeek = { w: number; a: number; d: number; c: number };
type RawStat = {
	total: number;
	weeks: StatWeek[];
	author: { login: string; avatar_url: string; html_url: string } | null;
};

const toIso = (weekSeconds: number) => new Date(weekSeconds * 1000).toISOString().slice(0, 10);

// Fold a contributor's weekly commit counts into a fixed number of sparkline buckets
function sparkline(weeks: StatWeek[]): number[] {
	if (!weeks.length) return [];
	const size = Math.ceil(weeks.length / SPARK_BUCKETS);
	const buckets: number[] = [];
	for (let i = 0; i < weeks.length; i += size) {
		buckets.push(weeks.slice(i, i + size).reduce((sum, week) => sum + week.c, 0));
	}
	return buckets;
}

// Turn the raw weekly stats into ranked rows with lines changed, recency and a sparkline
export function summariseContributors(raw: RawStat[]): ContributorRow[] {
	return raw
		.filter((stat) => stat.author && stat.total > 0)
		.map((stat) => {
			const weeks = stat.weeks ?? [];
			const active = weeks.filter((week) => week.c > 0);
			return {
				login: stat.author!.login,
				avatarUrl: stat.author!.avatar_url,
				htmlUrl: stat.author!.html_url,
				contributions: stat.total,
				additions: weeks.reduce((sum, week) => sum + week.a, 0),
				deletions: weeks.reduce((sum, week) => sum + week.d, 0),
				firstCommit: active.length ? toIso(active[0].w) : null,
				lastCommit: active.length ? toIso(active[active.length - 1].w) : null,
				spark: sparkline(weeks)
			};
		})
		.sort((first, second) => second.contributions - first.contributions);
}

// Repo-wide weekly churn, summed across contributors. The stats endpoint already
// carries per-week lines, so this reuses that payload with no extra request
export function weeklyChurn(raw: RawStat[]): WeekChurn[] {
	const byWeek = new Map<number, { additions: number; deletions: number }>();
	for (const stat of raw) {
		for (const week of stat.weeks ?? []) {
			const slot = byWeek.get(week.w) ?? { additions: 0, deletions: 0 };
			slot.additions += week.a;
			slot.deletions += week.d;
			byWeek.set(week.w, slot);
		}
	}
	const weeks = [...byWeek.entries()]
		.sort((first, second) => first[0] - second[0])
		.map(([seconds, churn]) => ({ week: toIso(seconds), ...churn }));
	// Drop the quiet lead-in so the chart opens on the first real activity
	const firstActive = weeks.findIndex((week) => week.additions || week.deletions);
	return firstActive <= 0 ? weeks : weeks.slice(firstActive);
}

async function fetchContributors(owner: string, name: string): Promise<RepoContributors> {
	const [stats, total] = await Promise.all([
		fetchStatsEndpoint<RawStat>(
			`/repos/${owner}/${name}/stats/contributors`,
			`contributor stats for ${owner}/${name}`
		),
		fetchCount(owner, name)
	]);
	if (stats === null)
		statsPending(
			repoKey(owner, name),
			() => getRepoContributors(owner, name),
			`contributor stats for ${owner}/${name}`
		);
	const contributors = summariseContributors(stats);
	// The stats endpoint tops out at 100 contributors, so flag when there are more
	const sampled = total > contributors.length;
	return { contributors, total, sampled, weekly: weeklyChurn(stats) };
}

const repoKey = (owner: string, name: string) =>
	`repo:contributors:v3:${owner}/${name}`.toLowerCase();

export const isRepoContributorsCached = (owner: string, name: string) =>
	isCached(repoKey(owner, name));

// Ranked contributor leaderboard for a single repo, with commits, lines and activity
export function getRepoContributors(owner: string, name: string): Promise<RepoContributors> {
	return cached(repoKey(owner, name), () => fetchContributors(owner, name), DAY);
}
