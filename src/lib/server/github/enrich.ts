import { cached } from '$lib/server/cache';
import { getUserOverview } from '$lib/server/github/user';
import { mapLimit } from '$lib/server/concurrency';
import { createLogger } from '$lib/logger';
import { AppError } from '$lib/errors';
import type { OwnedRepoData, Repo } from '$lib/types';

const MAX_REPOS = 150;
const CONCURRENCY = 8;
// Let a few flaky repos slide, but bail past this so we never cache a half-done map
const MAX_FAILURE_RATE = 0.05;

// Build a bounded per-repo map, bailing rather than caching a half-done refresh
export function enrichOwnedRepos<T>(
	scope: string,
	login: string,
	ttl: number,
	fetchOne: (repo: Repo) => Promise<T | null>
): Promise<OwnedRepoData<T>> {
	const log = createLogger(scope);
	return cached(
		`user:${scope}:${login.toLowerCase()}`,
		async () => {
			const { ownedRepos } = await getUserOverview(login);
			const targets = ownedRepos.slice(0, MAX_REPOS);
			const out: Record<string, T> = {};
			let failures = 0;
			await mapLimit(targets, CONCURRENCY, async (repo) => {
				try {
					const value = await fetchOne(repo);
					if (value !== null) out[repo.nameWithOwner] = value;
				} catch (error) {
					failures += 1;
					log.warn(`${scope} failed for ${repo.nameWithOwner}`, error);
				}
			});
			if (failures > Math.floor(targets.length * MAX_FAILURE_RATE)) {
				throw new AppError('upstream', `${scope} refresh was incomplete`, { expose: false });
			}
			// Dropped repos make this a subset, so flag it sampled like the repo cap does
			return {
				repos: out,
				total: ownedRepos.length,
				sampled: targets.length < ownedRepos.length || failures > 0
			};
		},
		ttl
	);
}
