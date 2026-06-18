import { graphql } from '$lib/server/github/client';
import { getUserOverview } from '$lib/server/github/user';
import { cached, isCached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { createLogger } from '$lib/logger';
import type { LanguageUsage, Repo } from '$lib/types';

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

// Fold one repo's language edges into the running per-language totals
function accumulate(totals: Map<string, LanguageUsage>, edges: Edge[]) {
	for (const edge of edges) {
		const entry = totals.get(edge.node.name) ?? {
			name: edge.node.name,
			color: edge.node.color,
			bytes: 0,
			repos: 0
		};
		entry.bytes += edge.size;
		entry.repos += 1;
		totals.set(edge.node.name, entry);
	}
}

async function fetchChunk(repos: Repo[], totals: Map<string, LanguageUsage>) {
	const variables: Record<string, string> = {};
	repos.forEach((repo, index) => {
		variables[`o${index}`] = repo.owner;
		variables[`n${index}`] = repo.name;
	});
	const data = await graphql<Record<string, RepoLanguages>>(chunkQuery(repos.length), variables);
	for (const repo of Object.values(data)) {
		if (repo) accumulate(totals, repo.languages.edges);
	}
}

function chunk<T>(items: T[], size: number): T[][] {
	const groups: T[][] = [];
	for (let index = 0; index < items.length; index += size)
		groups.push(items.slice(index, index + size));
	return groups;
}

const langKey = (login: string) => `user:languages:2:${login.toLowerCase()}`;

// Whether language bytes are cached, so the page can render them inline
export const isLanguagesCached = (login: string) => isCached(langKey(login));

// Byte totals per language across a user's own non-fork repos, batched and cached
export function getOwnedLanguages(login: string): Promise<LanguageUsage[]> {
	return cached(
		langKey(login),
		async () => {
			const { ownedRepos } = await getUserOverview(login);
			// Every authored repo counts, forks are someone else's code so drop them
			const repos = ownedRepos.filter((repo) => !repo.isFork);
			const totals = new Map<string, LanguageUsage>();
			await mapLimit(chunk(repos, CHUNK), CHUNK_CONCURRENCY, async (group) => {
				try {
					await fetchChunk(group, totals);
				} catch (error) {
					log.warn('language chunk failed', error);
				}
			});
			return [...totals.values()].sort((first, second) => second.bytes - first.bytes);
		},
		TTL
	);
}
