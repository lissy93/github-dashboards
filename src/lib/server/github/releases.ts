import { rest } from '$lib/server/github/client';
import { isCached, readCached, writeCached } from '$lib/server/cache';
import { logError } from '$lib/errors';

// Releases rarely change, so cache them for a day
const TTL = 86400;
const PER_PAGE = 100;
const PAGES_PER_SYNC = 3;

export type ReleaseRow = {
	name: string;
	tag: string;
	publishedAt: string;
	prerelease: boolean;
	downloads: number;
	hasAssets: boolean;
	url: string;
	author: string | null;
};
export type RepoReleases = { releases: ReleaseRow[]; total: number; sampled: boolean };

type RawAsset = { download_count: number };
type RawRelease = {
	name: string | null;
	tag_name: string;
	published_at: string | null;
	draft: boolean;
	prerelease: boolean;
	html_url: string;
	assets: RawAsset[];
	author?: { login: string } | null;
};

type ReleaseState = { rows: ReleaseRow[]; nextPage: number; complete: boolean };

const key = (owner: string, name: string) => `repo:releases:v3:${owner}/${name}`.toLowerCase();
const syncing = new Map<string, Promise<ReleaseState>>();

export const isRepoReleasesCached = (owner: string, name: string) => isCached(key(owner, name));

function toRow(raw: RawRelease): ReleaseRow {
	return {
		name: raw.name || raw.tag_name,
		tag: raw.tag_name,
		publishedAt: raw.published_at ?? '',
		prerelease: raw.prerelease,
		downloads: raw.assets.reduce((sum, asset) => sum + asset.download_count, 0),
		hasAssets: raw.assets.length > 0,
		url: raw.html_url,
		author: raw.author?.login ?? null
	};
}

function mergeRows(...groups: ReleaseRow[][]): ReleaseRow[] {
	return [...new Map(groups.flat().map((release) => [release.url, release])).values()].sort(
		(first, second) => first.publishedAt.localeCompare(second.publishedAt)
	);
}

async function sync(owner: string, name: string, current?: ReleaseState): Promise<ReleaseState> {
	const cacheKey = key(owner, name);
	const running = syncing.get(cacheKey);
	if (running) return running;

	const task = (async () => {
		const newest =
			(await rest<RawRelease[]>(`/repos/${owner}/${name}/releases?per_page=${PER_PAGE}&page=1`)) ??
			[];
		let rows = mergeRows(
			current?.rows ?? [],
			newest.filter((release) => !release.draft && release.published_at).map(toRow)
		);
		let nextPage = current?.nextPage ?? 2;
		let complete = current?.complete ?? newest.length < PER_PAGE;

		for (let count = 0; !complete && count < PAGES_PER_SYNC; count++) {
			let batch: RawRelease[];
			try {
				batch =
					(await rest<RawRelease[]>(
						`/repos/${owner}/${name}/releases?per_page=${PER_PAGE}&page=${nextPage}`
					)) ?? [];
			} catch (caught) {
				logError('repo-releases-page', caught);
				break;
			}
			rows = mergeRows(
				rows,
				batch.filter((release) => !release.draft && release.published_at).map(toRow)
			);
			nextPage += 1;
			complete = batch.length < PER_PAGE;
		}

		const state = { rows, nextPage, complete };
		await writeCached(cacheKey, state, TTL);
		return state;
	})().finally(() => syncing.delete(cacheKey));

	syncing.set(cacheKey, task);
	return task;
}

// Published releases accumulated across visits, with stale data served during refresh
export async function getRepoReleases(owner: string, name: string): Promise<RepoReleases> {
	const cacheKey = key(owner, name);
	let stored: Awaited<ReturnType<typeof readCached<ReleaseState>>> = null;
	try {
		stored = await readCached<ReleaseState>(cacheKey);
	} catch (caught) {
		logError('repo-releases-cache', caught);
	}
	if (!stored) {
		const state = await sync(owner, name);
		return { releases: state.rows, total: state.rows.length, sampled: !state.complete };
	}

	const stale = Date.now() - stored.fetchedAt.getTime() >= TTL * 1000;
	if (stale) {
		void sync(owner, name, stored.value).catch((caught) =>
			logError('repo-releases-refresh', caught)
		);
	}
	return {
		releases: stored.value.rows,
		total: stored.value.rows.length,
		sampled: !stored.value.complete
	};
}
