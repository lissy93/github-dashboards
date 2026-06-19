import { graphql } from '$lib/server/github/client';
import { getUserOverview } from '$lib/server/github/user';
import { cached, isCached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { createLogger } from '$lib/logger';
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

const repoLangKey = (login: string) => `user:repo-languages:1:${login.toLowerCase()}`;
const langKey = (login: string) => `user:languages:2:${login.toLowerCase()}`;

// Whether per-repo language bytes are cached, so the page can render them inline
export const isRepoLanguagesCached = (login: string) => isCached(repoLangKey(login));

// Whether language totals are cached, so the page can render them inline
export const isLanguagesCached = (login: string) => isCached(langKey(login));

// Language byte breakdown for each of a user's own non-fork repos, keyed by repo.
// The heavy fetch both the totals and the per-year chart share, batched and cached
export function getRepoLanguages(login: string): Promise<Record<string, RepoLang[]>> {
	return cached(
		repoLangKey(login),
		async () => {
			const { ownedRepos } = await getUserOverview(login);
			// Every authored repo counts, forks are someone else's code so drop them
			const repos = ownedRepos.filter((repo) => !repo.isFork);
			const map: Record<string, RepoLang[]> = {};
			await mapLimit(chunk(repos, CHUNK), CHUNK_CONCURRENCY, async (group) => {
				try {
					Object.assign(map, await fetchChunk(group));
				} catch (error) {
					log.warn('language chunk failed', error);
				}
			});
			return map;
		},
		TTL
	);
}

// Byte totals per language across a user's repos, derived from the per-repo map
export function getOwnedLanguages(login: string): Promise<LanguageUsage[]> {
	return cached(
		langKey(login),
		async () => {
			const map = await getRepoLanguages(login);
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
			return [...totals.values()].sort((first, second) => second.bytes - first.bytes);
		},
		TTL
	);
}
