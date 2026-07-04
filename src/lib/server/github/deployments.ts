import type { DeployRecord, EnvironmentSummary, RepoDeployments } from '$lib/types';
import { paginate } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';
import { bucketOutcomes } from '$lib/utils/outcomes';
import { deployBand } from '$lib/views/repo-deployments';

// Deployments move on push, refresh on visit like the rest of the board
const TTL = 900;
// Most recent deployments sampled, bounded so a busy repo never floods the API
const MAX_PAGES = 5;
const PAGE = 100;
// Rows kept for the recent-deployments table
const RECENT_LIMIT = 50;

const EMPTY: RepoDeployments = {
	totalDeployments: 0,
	sampled: false,
	successRate: null,
	lastDeployAt: null,
	environments: [],
	recent: [],
	frequency: []
};

type RawDeployment = {
	environment: string | null;
	createdAt: string;
	commitOid: string;
	ref: { name: string } | null;
	creator: { login: string } | null;
	latestStatus: {
		state: string | null;
		environmentUrl: string | null;
		logUrl: string | null;
		description: string | null;
	} | null;
};
type EnvNode = {
	name: string;
	protectionRules: { totalCount: number } | null;
};
type RawPage = {
	repository: {
		environments: { nodes: EnvNode[] };
		deployments: {
			totalCount: number;
			pageInfo: { hasNextPage: boolean; endCursor: string | null };
			nodes: RawDeployment[];
		};
	} | null;
};

const QUERY = `
	query RepoDeployments($owner: String!, $name: String!, $cursor: String) {
		repository(owner: $owner, name: $name) {
			environments(first: 100) {
				nodes { name protectionRules(first: 1) { totalCount } }
			}
			deployments(first: ${PAGE}, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }) {
				totalCount
				pageInfo { hasNextPage endCursor }
				nodes {
					environment
					createdAt
					commitOid
					ref { name }
					creator { login }
					latestStatus { state environmentUrl logUrl description }
				}
			}
		}
	}
`;

function toRecord(node: RawDeployment): DeployRecord {
	return {
		environment: node.environment ?? 'unknown',
		state: node.latestStatus?.state?.toLowerCase() ?? null,
		ref: node.ref?.name ?? null,
		commitOid: node.commitOid,
		creator: node.creator?.login ?? null,
		createdAt: node.createdAt,
		url: node.latestStatus?.environmentUrl || null,
		logUrl: node.latestStatus?.logUrl || null,
		description: node.latestStatus?.description || null
	};
}

// Group deployments by environment, keeping the latest deploy and the latest live one.
// Records arrive newest first, so the first seen per environment is already the latest
function summariseEnvironments(nodes: EnvNode[], records: DeployRecord[]): EnvironmentSummary[] {
	const envs = new Map<string, EnvironmentSummary>(
		nodes.map((node) => [
			node.name,
			{
				name: node.name,
				count: 0,
				last: null,
				live: null,
				protected: (node.protectionRules?.totalCount ?? 0) > 0
			}
		])
	);
	for (const record of records) {
		const env = envs.get(record.environment) ?? {
			name: record.environment,
			count: 0,
			last: null,
			live: null,
			protected: false
		};
		env.count += 1;
		env.last ??= record;
		if (!env.live && deployBand(record.state) === 'success') env.live = record;
		envs.set(record.environment, env);
	}
	// Busiest environments first, with empty configured environments trailing
	return [...envs.values()].sort((a, b) => b.count - a.count);
}

async function fetchDeployments(owner: string, name: string): Promise<RepoDeployments> {
	let envNodes: EnvNode[] = [];
	let total = 0;
	let missing = false;
	const { nodes } = await paginate<RawDeployment, RawPage>(
		QUERY,
		{ owner, name },
		({ repository }) => {
			if (!repository) {
				missing = true;
				return null;
			}
			if (!envNodes.length) envNodes = repository.environments.nodes;
			total = repository.deployments.totalCount;
			return repository.deployments;
		},
		{ maxPages: MAX_PAGES }
	);
	if (missing || !total) return EMPTY;
	const records = nodes.map(toRecord);

	const decisive = records.filter((record) => deployBand(record.state) !== 'other');
	const passed = decisive.filter((record) => deployBand(record.state) === 'success').length;
	return {
		totalDeployments: total,
		sampled: total > records.length,
		successRate: decisive.length ? passed / decisive.length : null,
		lastDeployAt: records[0]?.createdAt ?? null,
		environments: summariseEnvironments(envNodes, records),
		recent: records.slice(0, RECENT_LIMIT),
		frequency: bucketOutcomes(
			records.map((record) => ({ at: record.createdAt, outcome: deployBand(record.state) }))
		)
	};
}

const key = (owner: string, name: string) => `repo:deployments:v2:${owner}/${name}`.toLowerCase();

export const isRepoDeploymentsCached = (owner: string, name: string) => isCached(key(owner, name));

export function getRepoDeployments(owner: string, name: string): Promise<RepoDeployments> {
	return cached(key(owner, name), () => fetchDeployments(owner, name), TTL);
}
