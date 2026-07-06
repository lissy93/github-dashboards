import { graphql } from '$lib/server/github/client';
import { getUserOverview } from '$lib/server/github/user';
import { cached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { AppError } from '$lib/utils/errors';
import { createLogger } from '$lib/utils/logger';
import type { Repo, RecentStar } from '$lib/types';

const log = createLogger('latest-stargazers');

// Most recent stars cluster on a user's biggest repos, so only scan the top few
const TOP_REPOS = 40;
const KEEP = 12;
const CONCURRENCY = 6;
const TTL = 6 * 3600;

// The most recent stargazers across a user's owned repos, merged and deduped
export function getLatestStargazers(login: string): Promise<RecentStar[]> {
	return cached(
		`user:latest-stargazers:v1:${login.toLowerCase()}`,
		async () => {
			const { ownedRepos } = await getUserOverview(login);
			const targets = ownedRepos
				.filter((repo) => repo.stars > 0)
				.sort((first, second) => second.stars - first.stars)
				.slice(0, TOP_REPOS);
			const perRepo = await mapLimit(targets, CONCURRENCY, (repo) => newestForRepo(repo));
			const ok = perRepo.filter((result): result is RecentStar[] => result !== null);
			// Every fetch failing is a transient upstream problem, not a real restriction,
			// so throw uncached and let the next visit retry rather than pinning a false gate
			if (targets.length && !ok.length) {
				throw new AppError('upstream', 'Could not load recent stargazers', { expose: false });
			}
			const merged = mergeNewest(ok.flat());
			// A successful but empty list on repos that have stars means GitHub restricted it
			// to admins, surface that instead of caching a false "no recent stars"
			if (ok.length && !merged.length) {
				throw new AppError('forbidden', 'GitHub restricts stargazer lists to repo admins');
			}
			return merged;
		},
		TTL
	);
}

type StarEdge = { starredAt: string; node: { login: string; avatarUrl: string } };

// Newest stargazers for one repo, null if the fetch fails
const NEWEST_QUERY = `
	query NewestStargazers($owner: String!, $name: String!, $keep: Int!) {
		repository(owner: $owner, name: $name) {
			stargazers(first: $keep, orderBy: { field: STARRED_AT, direction: DESC }) {
				edges { starredAt node { login avatarUrl } }
			}
		}
	}
`;

async function newestForRepo(repo: Repo): Promise<RecentStar[] | null> {
	try {
		const data = await graphql<{ repository: { stargazers: { edges: StarEdge[] } } | null }>(
			NEWEST_QUERY,
			{ owner: repo.owner, name: repo.name, keep: KEEP },
			'app'
		);
		const edges = data.repository?.stargazers.edges ?? [];
		return edges.map((edge) => ({
			login: edge.node.login,
			avatarUrl: edge.node.avatarUrl,
			repo: repo.name,
			starredAt: edge.starredAt
		}));
	} catch (error) {
		log.warn(`stargazers failed for ${repo.nameWithOwner}`, error);
		return null;
	}
}

// Newest first, one row per person keeping their most recent star
function mergeNewest(stars: RecentStar[]): RecentStar[] {
	const byLogin = new Map<string, RecentStar>();
	for (const star of stars) {
		const seen = byLogin.get(star.login);
		if (!seen || star.starredAt > seen.starredAt) byLogin.set(star.login, star);
	}
	return [...byLogin.values()]
		.sort((first, second) => second.starredAt.localeCompare(first.starredAt))
		.slice(0, KEEP);
}
