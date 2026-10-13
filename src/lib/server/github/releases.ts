import type { ReleaseRow, RepoReleases } from '$lib/types';
import { rest } from '$lib/server/github/client';
import { advanceCheckpointed, checkpointed, readCached } from '$lib/server/cache';
import { logError } from '$lib/utils/errors';

// Releases rarely change, so cache them for a day
const TTL = 86400;
const PER_PAGE = 100;
const PAGES_PER_SYNC = 3;

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

// Refresh the newest page, then resume walking older pages from the checkpoint
async function sync(owner: string, name: string, current?: ReleaseState): Promise<ReleaseState> {
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

	return { rows, nextPage, complete };
}

const toReleases = (state: ReleaseState): RepoReleases => ({
	releases: state.rows,
	total: state.rows.length,
	sampled: !state.complete
});

// Published releases accumulated across visits, with stale data served during refresh
export async function getRepoReleases(owner: string, name: string): Promise<RepoReleases> {
	const state = await checkpointed<ReleaseState>(
		'repo-releases',
		key(owner, name),
		TTL,
		(current) => sync(owner, name, current)
	);
	return toReleases(state);
}

// Walk one more chunk of older releases on demand and persist it, so a signed-in
// viewer can fill the table past the background bound, cached for later viewers
export async function advanceRepoReleases(owner: string, name: string): Promise<RepoReleases> {
	const stored = await readCached<ReleaseState>(key(owner, name));
	const current = stored?.value;
	if (current?.complete) return toReleases(current);
	return toReleases(
		await advanceCheckpointed<ReleaseState>(key(owner, name), TTL, (state) =>
			sync(owner, name, state)
		)
	);
}
