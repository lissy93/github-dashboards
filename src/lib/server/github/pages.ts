import { rest } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';
import { AppError } from '$lib/errors';

// Pages config rarely changes, refresh every 15 minutes
const TTL = 900;

export type PagesBuild = {
	status: string;
	createdAt: string;
	duration: number;
	commitSha: string | null;
	url: string | null;
	error: string | null;
};
export type RepoPages = {
	enabled: boolean;
	url: string | null;
	cname: string | null;
	https: boolean;
	source: { branch: string; path: string } | null;
	buildType: string | null;
	status: string | null;
	builds: PagesBuild[];
	certificate: { state: string; expiresAt: string | null } | null;
};

const EMPTY: RepoPages = {
	enabled: false,
	url: null,
	cname: null,
	https: false,
	source: null,
	buildType: null,
	status: null,
	builds: [],
	certificate: null
};

type RawPages = {
	url: string;
	html_url: string | null;
	status: string | null;
	cname: string | null;
	https_enforced?: boolean;
	build_type: string | null;
	source: { branch: string; path: string } | null;
	http_certificate?: { state: string; expires_at: string | null } | null;
};
type RawBuild = {
	status: string;
	created_at: string;
	duration: number;
	commit: string | null;
	url: string;
	error?: { message: string | null } | null;
};

// Pages 404 means not enabled, 403 means no access (not an error)
async function tryPages<T>(path: string): Promise<T | null> {
	try {
		return await rest<T>(path);
	} catch (error) {
		if (error instanceof AppError && (error.code === 'not_found' || error.code === 'forbidden'))
			return null;
		throw error;
	}
}

async function fetchPages(owner: string, name: string): Promise<RepoPages> {
	const info = await tryPages<RawPages>(`/repos/${owner}/${name}/pages`);
	if (!info) return EMPTY;

	const rawBuilds =
		(await tryPages<RawBuild[]>(`/repos/${owner}/${name}/pages/builds?per_page=20`)) ?? [];

	return {
		enabled: true,
		url: info.html_url || null,
		cname: info.cname || null,
		https: info.https_enforced ?? false,
		source: info.source,
		buildType: info.build_type,
		status: info.status,
		builds: rawBuilds.map((b) => ({
			status: b.status,
			createdAt: b.created_at,
			// The Pages builds API reports duration in milliseconds, store it in seconds like the rest
			duration: Math.round((b.duration ?? 0) / 1000),
			commitSha: b.commit,
			url: b.url,
			error: b.error?.message ?? null
		})),
		certificate: info.http_certificate
			? { state: info.http_certificate.state, expiresAt: info.http_certificate.expires_at }
			: null
	};
}

const key = (owner: string, name: string) => `repo:pages:v3:${owner}/${name}`.toLowerCase();

export const isRepoPagesCached = (owner: string, name: string) => isCached(key(owner, name));

export function getRepoPages(owner: string, name: string): Promise<RepoPages> {
	return cached(key(owner, name), () => fetchPages(owner, name), TTL);
}
