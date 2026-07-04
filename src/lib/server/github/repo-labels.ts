import type { LabelCount } from '$lib/types';
import { paginate } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';

// Labels move slowly, so cache them alongside the other day-scale repo stats
const TTL = 6 * 3600;
const PER_PAGE = 100;
const MAX_PAGES = 5;

// One label and how many issues and PRs carry it
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
	const { nodes, complete } = await paginate<RawLabel, Raw>(
		QUERY,
		{ owner, name },
		(data) => data.repository?.labels,
		{ maxPages: MAX_PAGES }
	);
	const labels = nodes.map((node) => {
		const issues = node.issues.totalCount;
		const prs = node.pullRequests.totalCount;
		return { name: node.name, color: node.color, issues, prs, total: issues + prs };
	});
	// Heaviest labels first, dropping the unused ones that would only clutter the chart
	const used = labels.filter((label) => label.total > 0).sort((a, b) => b.total - a.total);
	return { labels: used, sampled: !complete };
}

const key = (owner: string, name: string) => `repo:labels:v1:${owner}/${name}`.toLowerCase();

export const isRepoLabelsCached = (owner: string, name: string) => isCached(key(owner, name));

// Label usage across a repo's issues and PRs, for the work-mix treemap
export function getRepoLabels(owner: string, name: string): Promise<RepoLabels> {
	return cached(key(owner, name), () => fetchLabels(owner, name), TTL);
}
