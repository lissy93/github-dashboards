import { graphql } from '$lib/server/github/client';
import { enrichOwnedRepos } from '$lib/server/github/enrich';
import { cached } from '$lib/server/cache';
import type { OwnedRepoData, RepoStats } from '$lib/types';

// Heavier counts move slowly, so cache them longer than the live overview
const TTL = 6 * 3600;

// One repo per query so the heavier counts never trip the GraphQL timeout
const QUERY = `
	query RepoStats($owner: String!, $name: String!) {
		repository(owner: $owner, name: $name) {
			closedIssues: issues(states: CLOSED) { totalCount }
			mergedPRs: pullRequests(states: MERGED) { totalCount }
			closedPRs: pullRequests(states: CLOSED) { totalCount }
			releases { totalCount }
			latestRelease { tagName publishedAt }
			defaultBranchRef { target { ... on Commit { history { totalCount } } } }
		}
	}
`;

type Raw = {
	repository: {
		closedIssues: { totalCount: number };
		mergedPRs: { totalCount: number };
		closedPRs: { totalCount: number };
		releases: { totalCount: number };
		latestRelease: { tagName: string; publishedAt: string } | null;
		defaultBranchRef: { target: { history?: { totalCount: number } } | null } | null;
	} | null;
};

async function fetchStats(owner: string, name: string): Promise<RepoStats | null> {
	const { repository } = await graphql<Raw>(QUERY, { owner, name });
	if (!repository) return null;
	return {
		closedIssues: repository.closedIssues.totalCount,
		mergedPRs: repository.mergedPRs.totalCount,
		closedPRs: repository.closedPRs.totalCount,
		commits: repository.defaultBranchRef?.target?.history?.totalCount ?? 0,
		releaseCount: repository.releases.totalCount,
		latestRelease: repository.latestRelease
			? { tag: repository.latestRelease.tagName, publishedAt: repository.latestRelease.publishedAt }
			: null
	};
}

// Heavier counts for the owned repos, cached as one entry with a bounded refresh
export function getOwnedRepoStats(login: string): Promise<OwnedRepoData<RepoStats>> {
	return enrichOwnedRepos('repo-stats:v3', login, TTL, (repo) => fetchStats(repo.owner, repo.name));
}

// Heavier counts for a single repo, cached on its own. Null when the repo is gone
export function getRepoStats(owner: string, name: string): Promise<RepoStats | null> {
	return cached(`repo:stats:${owner}/${name}`.toLowerCase(), () => fetchStats(owner, name), TTL);
}
