import { PAGE_INFO, paginate, type Conn } from '$lib/server/github/client';

// Just enough per hit to tell which repo moved and when
const QUERY = `
	query RepoChanges($q: String!, $cursor: String) {
		search(query: $q, type: ISSUE, first: 100, after: $cursor) {
			${PAGE_INFO}
			nodes {
				... on Issue { updatedAt repository { nameWithOwner } }
				... on PullRequest { updatedAt repository { nameWithOwner } }
			}
		}
	}
`;
// Steady state is a single page, a long catch-up resumes over later checks
const MAX_PAGES = 5;
// Search indexing trails real updates, so each window overlaps the last by this much
const INDEX_LAG_MS = 10 * 60000;

type Hit = { updatedAt: string; repository: { nameWithOwner: string } };
type Page = { search: Conn<Hit> };

// Each repo's (lowercase owner/name) latest change, and where the next look picks up
export type RepoChanges = { checkedAt: string; repos: Record<string, string> };

// Fold oldest-first hits into each repo's latest change, a capped walk resumes from its last hit
export function foldChanges(hits: Hit[], complete: boolean, startedAt: number): RepoChanges {
	const repos: Record<string, string> = {};
	for (const hit of hits) repos[hit.repository.nameWithOwner.toLowerCase()] = hit.updatedAt;
	const last = hits.at(-1);
	const checkedAt =
		!complete && last ? last.updatedAt : new Date(startedAt - INDEX_LAG_MS).toISOString();
	return { checkedAt, repos };
}

// Issue and PR activity across every repo the account owns since a point in time
export async function findChanges(login: string, since: string): Promise<RepoChanges> {
	const startedAt = Date.now();
	const { nodes, complete } = await paginate<Hit, Page>(
		QUERY,
		{ q: `user:${login} updated:>=${since} sort:updated-asc` },
		({ search }) => search,
		{ maxPages: MAX_PAGES }
	);
	return foldChanges(nodes, complete, startedAt);
}
