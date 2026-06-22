import { graphql } from '$lib/server/github/client';
import { getUserOverview } from '$lib/server/github/user';
import { cached, isCached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { createLogger } from '$lib/logger';
import { AppError } from '$lib/errors';
import type { LanguageUsage, RepoLang, Repo } from '$lib/types';

const log = createLogger('languages');
const TTL = 86400;
const CHUNK = 20;
const CHUNK_CONCURRENCY = 3;

type Edge = { size: number; node: { name: string; color: string | null } };
type RepoLanguages = { languages: { edges: Edge[] } } | null;

// One aliased repository field per repo, so a chunk loads in a single request
function chunkQuery(size: number): string {
	const params = Array.from(
		{ length: size },
		(_, index) => `$o${index}: String!, $n${index}: String!`
	);
	const fields = Array.from(
		{ length: size },
		(_, index) =>
			`r${index}: repository(owner: $o${index}, name: $n${index}) {
				languages(first: 100, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
			}`
	);
	return `query RepoLanguages(${params.join(', ')}) { ${fields.join('\n')} }`;
}

// One chunk's repos resolved to their language byte breakdowns, keyed by repo
async function fetchChunk(repos: Repo[]): Promise<Record<string, RepoLang[]>> {
	const variables: Record<string, string> = {};
	repos.forEach((repo, index) => {
		variables[`o${index}`] = repo.owner;
		variables[`n${index}`] = repo.name;
	});
	const data = await graphql<Record<string, RepoLanguages>>(chunkQuery(repos.length), variables);
	const out: Record<string, RepoLang[]> = {};
	repos.forEach((repo, index) => {
		const node = data[`r${index}`];
		if (node) {
			out[repo.nameWithOwner] = node.languages.edges.map((edge) => ({
				name: edge.node.name,
				color: edge.node.color,
				bytes: edge.size
			}));
		}
	});
	return out;
}

function chunk<T>(items: T[], size: number): T[][] {
	const groups: T[][] = [];
	for (let index = 0; index < items.length; index += size)
		groups.push(items.slice(index, index + size));
	return groups;
}

type LanguageData = {
	repos: Record<string, RepoLang[]>;
	totals: LanguageUsage[];
};

const languageKey = (login: string) => `user:language-data:3:${login.toLowerCase()}`;

// Both language views share one cache entry so they can never refresh out of step
export const isRepoLanguagesCached = (login: string) => isCached(languageKey(login));
export const isLanguagesCached = isRepoLanguagesCached;

// Fetch the per-repo map and aggregate totals as one atomic cached dataset
function getLanguageData(login: string): Promise<LanguageData> {
	return cached(
		languageKey(login),
		async () => {
			const { ownedRepos } = await getUserOverview(login);
			const repos = ownedRepos.filter((repo) => !repo.isFork);
			const map: Record<string, RepoLang[]> = {};
			let failures = 0;
			await mapLimit(chunk(repos, CHUNK), CHUNK_CONCURRENCY, async (group) => {
				try {
					Object.assign(map, await fetchChunk(group));
				} catch (error) {
					failures += 1;
					log.warn('language chunk failed', error);
				}
			});
			if (failures) {
				throw new AppError('upstream', 'Language refresh was incomplete', { expose: false });
			}
			const totals = new Map<string, LanguageUsage>();
			for (const langs of Object.values(map)) {
				for (const lang of langs) {
					const entry = totals.get(lang.name) ?? {
						name: lang.name,
						color: lang.color,
						bytes: 0,
						repos: 0
					};
					entry.bytes += lang.bytes;
					entry.repos += 1;
					totals.set(lang.name, entry);
				}
			}
			return {
				repos: map,
				totals: [...totals.values()].sort((first, second) => second.bytes - first.bytes)
			};
		},
		TTL
	);
}

// Per-repo language bytes for the creation-year chart
export async function getRepoLanguages(login: string): Promise<Record<string, RepoLang[]>> {
	return (await getLanguageData(login)).repos;
}

// Byte totals per language across the user's authored repos
export async function getOwnedLanguages(login: string): Promise<LanguageUsage[]> {
	return (await getLanguageData(login)).totals;
}

const ONE_REPO_QUERY = `
	query OneRepoLanguages($owner: String!, $name: String!) {
		repository(owner: $owner, name: $name) {
			languages(first: 30, orderBy: { field: SIZE, direction: DESC }) {
				edges { size node { name color } }
			}
		}
	}
`;

const oneRepoKey = (owner: string, name: string) =>
	`repo:languages:v1:${owner}/${name}`.toLowerCase();

export const isRepoLanguageUsageCached = (owner: string, name: string) =>
	isCached(oneRepoKey(owner, name));

// Byte breakdown by language for a single repo, coloured from GitHub's palette
export function getRepoLanguageUsage(owner: string, name: string): Promise<LanguageUsage[]> {
	return cached(
		oneRepoKey(owner, name),
		async () => {
			const { repository } = await graphql<{ repository: RepoLanguages }>(ONE_REPO_QUERY, {
				owner,
				name
			});
			if (!repository) return [];
			return repository.languages.edges.map((edge) => ({
				name: edge.node.name,
				color: edge.node.color,
				bytes: edge.size,
				repos: 1
			}));
		},
		TTL
	);
}
