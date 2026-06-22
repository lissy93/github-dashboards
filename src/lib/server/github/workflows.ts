import { rest } from '$lib/server/github/client';
import { cached, isCached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { AppError } from '$lib/errors';

// Runs change but not second to second, refresh on visit like the rest of the board
const TTL = 900;
// Workflows scanned and runs sampled per workflow, bounded to stay within limits
const MAX_WORKFLOWS = 20;
const RUN_SAMPLE = 20;
const CONCURRENCY = 6;

export type WorkflowSummary = {
	id: number;
	name: string;
	state: string;
	path: string;
	latest: {
		status: string | null;
		conclusion: string | null;
		runUrl: string | null;
		createdAt: string | null;
	} | null;
	passRate: number | null;
	avgRuntimeSec: number | null;
	runsSampled: number;
};
export type RepoWorkflows = { workflows: WorkflowSummary[]; totalRuns: number | null };

type RawWorkflow = { id: number; name: string; state: string; path: string };
type RawRun = {
	status: string | null;
	conclusion: string | null;
	html_url: string | null;
	created_at: string;
	run_started_at: string | null;
	updated_at: string;
};

const EMPTY: RepoWorkflows = { workflows: [], totalRuns: 0 };

// A restricted repo or one with Actions off has no visible workflows, not an error
async function tryRest<T>(path: string): Promise<T | null> {
	try {
		return await rest<T>(path);
	} catch (error) {
		if (error instanceof AppError && error.code === 'forbidden') return null;
		throw error;
	}
}

// Pass rate and mean runtime over a workflow's recent completed runs
export function summarise(workflow: RawWorkflow, runs: RawRun[]): WorkflowSummary {
	const completed = runs.filter((run) => run.status === 'completed' && run.conclusion);
	const passed = completed.filter((run) => run.conclusion === 'success').length;
	const durations = completed.map(
		(run) => (Date.parse(run.updated_at) - Date.parse(run.run_started_at ?? run.created_at)) / 1000
	);
	const latest = runs[0];
	return {
		id: workflow.id,
		name: workflow.name,
		state: workflow.state,
		path: workflow.path,
		latest: latest
			? {
					status: latest.status,
					conclusion: latest.conclusion,
					runUrl: latest.html_url,
					createdAt: latest.created_at
				}
			: null,
		passRate: completed.length ? passed / completed.length : null,
		avgRuntimeSec: durations.length
			? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
			: null,
		runsSampled: completed.length
	};
}

async function fetchWorkflows(owner: string, name: string): Promise<RepoWorkflows> {
	const list = await tryRest<{ total_count: number; workflows: RawWorkflow[] }>(
		`/repos/${owner}/${name}/actions/workflows?per_page=${MAX_WORKFLOWS}`
	);
	if (!list?.workflows.length) return EMPTY;

	let totalRuns = 0;
	const workflows = await mapLimit(
		list.workflows.slice(0, MAX_WORKFLOWS),
		CONCURRENCY,
		async (workflow) => {
			const runs = await tryRest<{ total_count: number; workflow_runs: RawRun[] }>(
				`/repos/${owner}/${name}/actions/workflows/${workflow.id}/runs?per_page=${RUN_SAMPLE}`
			);
			totalRuns += runs?.total_count ?? 0;
			return summarise(workflow, runs?.workflow_runs ?? []);
		}
	);
	return { workflows, totalRuns };
}

const key = (owner: string, name: string) => `repo:workflows:${owner}/${name}`.toLowerCase();

export const isRepoWorkflowsCached = (owner: string, name: string) => isCached(key(owner, name));

// Per-workflow status, pass rate and average runtime for a repo's GitHub Actions
export function getRepoWorkflows(owner: string, name: string): Promise<RepoWorkflows> {
	return cached(key(owner, name), () => fetchWorkflows(owner, name), TTL);
}
