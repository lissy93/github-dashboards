import { rest } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';

// Releases rarely change, so cache them for a day
const TTL = 86400;
const PER_PAGE = 100;
// A few pages cover all but the most prolific projects, then we flag the rest
const MAX_PAGES = 3;

export type ReleaseRow = {
	name: string;
	tag: string;
	publishedAt: string;
	prerelease: boolean;
	downloads: number;
	url: string;
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
};

const key = (owner: string, name: string) => `repo:releases:v1:${owner}/${name}`.toLowerCase();

export const isRepoReleasesCached = (owner: string, name: string) => isCached(key(owner, name));

function toRow(raw: RawRelease): ReleaseRow {
	return {
		name: raw.name || raw.tag_name,
		tag: raw.tag_name,
		publishedAt: raw.published_at ?? '',
		prerelease: raw.prerelease,
		downloads: raw.assets.reduce((sum, asset) => sum + asset.download_count, 0),
		url: raw.html_url
	};
}

// Published releases oldest first, each with its total asset downloads. Drafts are
// skipped since they are not really released yet
export function getRepoReleases(owner: string, name: string): Promise<RepoReleases> {
	return cached(
		key(owner, name),
		async () => {
			const rows: ReleaseRow[] = [];
			let sampled = false;
			for (let page = 1; page <= MAX_PAGES; page++) {
				const batch =
					(await rest<RawRelease[]>(
						`/repos/${owner}/${name}/releases?per_page=${PER_PAGE}&page=${page}`
					)) ?? [];
				rows.push(...batch.filter((release) => !release.draft && release.published_at).map(toRow));
				if (batch.length < PER_PAGE) break;
				if (page === MAX_PAGES) sampled = true;
			}
			rows.sort((first, second) => first.publishedAt.localeCompare(second.publishedAt));
			return { releases: rows, total: rows.length, sampled };
		},
		TTL
	);
}
