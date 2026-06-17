import { cached } from '$lib/server/cache';
import { getUserOverview } from '$lib/server/github/user';
import { mapLimit } from '$lib/server/concurrency';
import { createLogger } from '$lib/logger';
import type { Repo } from '$lib/types';

const MAX_REPOS = 150;
const CONCURRENCY = 8;

// Fetch one value per owned repo, bounded and cached as a single keyed map.
// A failing repo is logged and dropped so one error never blanks the map
export function enrichOwnedRepos<T>(
	scope: string,
	login: string,
	ttl: number,
	fetchOne: (repo: Repo) => Promise<T | null>
): Promise<Record<string, T>> {
	const log = createLogger(scope);
	return cached(
		`user:${scope}:${login.toLowerCase()}`,
		async () => {
			const { ownedRepos } = await getUserOverview(login);
			const out: Record<string, T> = {};
			await mapLimit(ownedRepos.slice(0, MAX_REPOS), CONCURRENCY, async (repo) => {
				try {
					const value = await fetchOne(repo);
					if (value !== null) out[repo.nameWithOwner] = value;
				} catch (error) {
					log.warn(`${scope} failed for ${repo.nameWithOwner}`, error);
				}
			});
			return out;
		},
		ttl
	);
}
