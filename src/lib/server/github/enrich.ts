import { readCached, writeCached } from '$lib/server/cache';
import { getUserOverview } from '$lib/server/github/user';
import { mapLimit } from '$lib/server/concurrency';
import { createLogger } from '$lib/utils/logger';
import { AppError, toAppError } from '$lib/utils/errors';
import type { OwnedRepoData, Repo } from '$lib/types';

const REPOS_PER_SYNC = 24;
const CONCURRENCY = 8;
type EnrichmentState<T> = {
	data: OwnedRepoData<T>;
	covered: string[];
	nextIndex: number;
	source: string[];
};
const syncing = new Map<string, Promise<unknown>>();

// Build a bounded per-repo map, bailing rather than caching a half-done refresh
export function enrichOwnedRepos<T>(
	scope: string,
	login: string,
	ttl: number,
	fetchOne: (repo: Repo) => Promise<T | null>
): Promise<OwnedRepoData<T>> {
	const log = createLogger(scope);
	const key = `user:${scope}:progressive:${login.toLowerCase()}`;

	const refresh = (current?: EnrichmentState<T>): Promise<EnrichmentState<T>> => {
		const running = syncing.get(key);
		if (running) return running as Promise<EnrichmentState<T>>;
		const task = (async () => {
			const { ownedRepos } = await getUserOverview(login);
			const source = ownedRepos.map((repo) => repo.nameWithOwner);
			const sourceSet = new Set(source);
			const sameSource =
				current?.source.length === source.length &&
				current.source.every((name, index) => name === source[index]);
			const start = sameSource ? current.nextIndex % Math.max(1, ownedRepos.length) : 0;
			const targets = Array.from(
				{ length: Math.min(REPOS_PER_SYNC, ownedRepos.length) },
				(_, index) => ownedRepos[(start + index) % ownedRepos.length]
			);
			const out = Object.fromEntries(
				Object.entries(current?.data.repos ?? {}).filter(([name]) => sourceSet.has(name))
			) as Record<string, T>;
			const covered = new Set((current?.covered ?? []).filter((name) => sourceSet.has(name)));
			let failures = 0;
			await mapLimit(targets, CONCURRENCY, async (repo) => {
				try {
					const value = await fetchOne(repo);
					covered.add(repo.nameWithOwner);
					if (value !== null) out[repo.nameWithOwner] = value;
					else delete out[repo.nameWithOwner];
				} catch (error) {
					failures += 1;
					log.warn(`${scope} failed for ${repo.nameWithOwner}`, {
						code: toAppError(error).code
					});
				}
			});
			// On a cold start a mostly-failing batch means upstream is broken, so surface it
			// rather than caching a near-empty result as if it were the whole picture
			if (!current && failures > targets.length / 2) {
				throw new AppError('upstream', `${scope} refresh was incomplete`, { expose: false });
			}
			const state: EnrichmentState<T> = {
				data: {
					repos: out,
					total: ownedRepos.length,
					sampled: covered.size < ownedRepos.length || failures > 0
				},
				covered: [...covered],
				nextIndex: ownedRepos.length ? (start + targets.length) % ownedRepos.length : 0,
				source
			};
			await writeCached(key, state, ttl);
			return state;
		})().finally(() => syncing.delete(key));
		syncing.set(key, task);
		return task;
	};

	return readCached<EnrichmentState<T>>(key)
		.catch(() => null)
		.then(async (stored) => {
			if (!stored) return (await refresh()).data;
			if (Date.now() - stored.fetchedAt.getTime() >= ttl * 1000) {
				void refresh(stored.value).catch((error) =>
					log.warn(`${scope} refresh failed`, { code: toAppError(error).code })
				);
			}
			return stored.value.data;
		});
}
