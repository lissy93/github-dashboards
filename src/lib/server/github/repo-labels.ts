import { graphql } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';

// Labels move slowly, so cache them alongside the other day-scale repo stats
const TTL = 6 * 3600;
const PER_PAGE = 100;
const MAX_PAGES = 5;

// One label and how many issues and PRs carry it
export type LabelCount = {
	name: string;
	color: string;
	issues: number;
	prs: number;
	total: number;
};
export type RepoLabels = { labels: LabelCount[]; sampled: boolean };

const QUERY = `
	query RepoLabels($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			labels(first: ${PER_PAGE}, after: $cursor, orderBy: { field: NAME, direction: ASC }) {
				nodes { name color issues { totalCount } pullRequests { totalCount } }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
`;

type RawLabel = {
	name: string;
	color: string;
	issues: { totalCount: number };
	pullRequests: { totalCount: number };
};
type Raw = {
	repository: {
		labels: {
			nodes: RawLabel[];
			pageInfo: { hasNextPage: boolean; endCursor: string | null };
		};
	} | null;
};

async function fetchLabels(owner: string, name: string): Promise<RepoLabels> {
	const labels: LabelCount[] = [];
	let cursor: string | null = null;
	let sampled = false;
	for (let page = 0; page < MAX_PAGES; page++) {
		const data: Raw = await graphql<Raw>(QUERY, { owner, name, cursor });
		const conn = data.repository?.labels;
		if (!conn) break;
		for (const node of conn.nodes) {
			const issues = node.issues.totalCount;
			const prs = node.pullRequests.totalCount;
			labels.push({ name: node.name, color: node.color, issues, prs, total: issues + prs });
		}
		if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
		cursor = conn.pageInfo.endCursor;
		// Beyond the page budget there are still more labels than we charted
		if (page === MAX_PAGES - 1) sampled = true;
	}
	// Heaviest labels first, dropping the unused ones that would only clutter the chart
	const used = labels.filter((label) => label.total > 0).sort((a, b) => b.total - a.total);
	return { labels: used, sampled };
}

const key = (owner: string, name: string) => `repo:labels:v1:${owner}/${name}`.toLowerCase();

export const isRepoLabelsCached = (owner: string, name: string) => isCached(key(owner, name));

// Label usage across a repo's issues and PRs, for the work-mix treemap
export function getRepoLabels(owner: string, name: string): Promise<RepoLabels> {
	return cached(key(owner, name), () => fetchLabels(owner, name), TTL);
}
