import { rest } from '$lib/server/github/client';
import { cached, isCached, readCached, writeCached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { bucketOutcomes, type OutcomeBucket, type OutcomeKind } from '$lib/views/outcomes';
import { AppError, logError } from '$lib/errors';

// Runs change but not second to second, refresh on visit like the rest of the board
const TTL = 900;
// Workflows scanned and runs sampled per workflow, bounded to stay within limits
const WORKFLOWS_PER_SYNC = 20;
const LIST_PAGE = 100;
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
		event: string | null;
	} | null;
	passRate: number | null;
	avgRuntimeSec: number | null;
	runsSampled: number;
	retryRate: number | null;
};
export type RepoWorkflows = {
	workflows: WorkflowSummary[];
	totalRuns: number | null;
	totalWorkflows: number;
	sampled: boolean;
};

type RawWorkflow = { id: number; name: string; state: string; path: string };
type RawRun = {
	status: string | null;
	conclusion: string | null;
	html_url: string | null;
	created_at: string;
	run_started_at: string | null;
	updated_at: string;
	event: string | null;
	run_attempt: number;
};

const EMPTY: RepoWorkflows = {
	workflows: [],
	totalRuns: 0,
	totalWorkflows: 0,
	sampled: false
};
type WorkflowState = {
	metadata: RawWorkflow[];
	summaries: WorkflowSummary[];
	runTotals: Record<number, number>;
	totalWorkflows: number;
	nextIndex: number;
};

// A restricted repo or one with Actions off has no visible workflows, not an error
async function tryRest<T>(path: string): Promise<T | null> {
	try {
		return await rest<T>(path);
	} catch (error) {
		if (error instanceof AppError && error.code === 'forbidden') return null;
		throw error;
	}
}

// Pass rate over decisive runs and mean runtime over completed runs, with the sampled
// count tracking the decisive runs so it matches the pass-rate denominator on screen
export function summarise(workflow: RawWorkflow, runs: RawRun[]): WorkflowSummary {
	const completed = runs.filter((run) => run.status === 'completed' && run.conclusion);
	const decisive = completed.filter((run) =>
		['success', 'failure', 'timed_out', 'action_required'].includes(run.conclusion!)
	);
	const passed = decisive.filter((run) => run.conclusion === 'success').length;
	const retried = runs.filter((run) => run.run_attempt > 1).length;
	const durations = completed
		.map(
			(run) =>
				(Date.parse(run.updated_at) - Date.parse(run.run_started_at ?? run.created_at)) / 1000
		)
		.filter((seconds) => Number.isFinite(seconds) && seconds >= 0);
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
					createdAt: latest.created_at,
					event: latest.event
				}
			: null,
		passRate: decisive.length ? passed / decisive.length : null,
		avgRuntimeSec: durations.length
			? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
			: null,
		runsSampled: decisive.length,
		retryRate: runs.length ? retried / runs.length : null
	};
}

function mergeMetadata(...groups: RawWorkflow[][]): RawWorkflow[] {
	return [...new Map(groups.flat().map((workflow) => [workflow.id, workflow])).values()];
}

async function sync(owner: string, name: string, current?: WorkflowState): Promise<WorkflowState> {
	const first = await tryRest<{ total_count: number; workflows: RawWorkflow[] }>(
		`/repos/${owner}/${name}/actions/workflows?per_page=${LIST_PAGE}&page=1`
	);
	if (!first)
		return { metadata: [], summaries: [], runTotals: {}, totalWorkflows: 0, nextIndex: 0 };

	let metadata = mergeMetadata(current?.metadata ?? [], first.workflows);
	if (metadata.length < first.total_count) {
		const page = Math.floor(metadata.length / LIST_PAGE) + 1;
		const more = await tryRest<{ workflows: RawWorkflow[] }>(
			`/repos/${owner}/${name}/actions/workflows?per_page=${LIST_PAGE}&page=${page}`
		);
		metadata = mergeMetadata(metadata, more?.workflows ?? []);
	}
	metadata = metadata.slice(0, first.total_count);

	const start = current?.nextIndex ?? 0;
	const targets = metadata.slice(start, start + WORKFLOWS_PER_SYNC);
	const summaries = new Map((current?.summaries ?? []).map((item) => [item.id, item]));
	const runTotals = { ...(current?.runTotals ?? {}) };
	await mapLimit(targets, CONCURRENCY, async (workflow) => {
		try {
			const runs = await tryRest<{ total_count: number; workflow_runs: RawRun[] }>(
				`/repos/${owner}/${name}/actions/workflows/${workflow.id}/runs?per_page=${RUN_SAMPLE}`
			);
			runTotals[workflow.id] = runs?.total_count ?? 0;
			summaries.set(workflow.id, summarise(workflow, runs?.workflow_runs ?? []));
		} catch (caught) {
			logError(`repo-workflow:${workflow.id}`, caught);
		}
	});
	const nextIndex = start + targets.length >= metadata.length ? 0 : start + targets.length;
	return {
		metadata,
		summaries: metadata.flatMap((workflow) => {
			const summary = summaries.get(workflow.id);
			return summary ? [summary] : [];
		}),
		runTotals,
		totalWorkflows: first.total_count,
		nextIndex
	};
}

const key = (owner: string, name: string) =>
	`repo:workflows-state:v2:${owner}/${name}`.toLowerCase();
const syncing = new Map<string, Promise<WorkflowState>>();

export const isRepoWorkflowsCached = (owner: string, name: string) => isCached(key(owner, name));

async function refresh(owner: string, name: string, current?: WorkflowState) {
	const cacheKey = key(owner, name);
	const running = syncing.get(cacheKey);
	if (running) return running;
	const task = sync(owner, name, current)
		.then(async (state) => {
			await writeCached(cacheKey, state, TTL);
			return state;
		})
		.finally(() => syncing.delete(cacheKey));
	syncing.set(cacheKey, task);
	return task;
}

function toResult(state: WorkflowState): RepoWorkflows {
	const complete =
		state.metadata.length >= state.totalWorkflows && state.summaries.length >= state.totalWorkflows;
	return {
		workflows: state.summaries,
		totalRuns: complete
			? Object.values(state.runTotals).reduce((sum, total) => sum + total, 0)
			: null,
		totalWorkflows: state.totalWorkflows,
		sampled: !complete
	};
}

// Per-workflow status accumulated in bounded batches, serving prior summaries during refresh
export async function getRepoWorkflows(owner: string, name: string): Promise<RepoWorkflows> {
	const cacheKey = key(owner, name);
	const stored = await readCached<WorkflowState>(cacheKey).catch(() => null);
	if (!stored) {
		const state = await refresh(owner, name);
		return state.totalWorkflows ? toResult(state) : EMPTY;
	}
	if (Date.now() - stored.fetchedAt.getTime() >= TTL * 1000) {
		void refresh(owner, name, stored.value).catch((caught) =>
			logError('repo-workflows-refresh', caught)
		);
	}
	return toResult(stored.value);
}

// Recent runs across all workflows, for the repo-wide outcome trend. Bounded to a few
// pages so a busy repo never floods the API while a quiet one still shows its full history
const RUN_ACTIVITY_PAGES = 3;
const RUN_ACTIVITY_PAGE = 100;

export type RepoRunActivity = { buckets: OutcomeBucket[]; total: number; sampled: boolean };
const EMPTY_RUN_ACTIVITY: RepoRunActivity = { buckets: [], total: 0, sampled: false };

type RunFeedItem = { created_at: string; conclusion: string | null };

// A run's conclusion mapped to the shared success / failure / other bands
function runOutcome(conclusion: string | null): OutcomeKind {
	if (conclusion === 'success') return 'success';
	if (conclusion === 'failure' || conclusion === 'timed_out') return 'failure';
	return 'other';
}

async function fetchRunActivity(owner: string, name: string): Promise<RepoRunActivity> {
	const runs: RunFeedItem[] = [];
	let total = 0;
	for (let page = 1; page <= RUN_ACTIVITY_PAGES; page++) {
		const batch = await tryRest<{ total_count: number; workflow_runs: RunFeedItem[] }>(
			`/repos/${owner}/${name}/actions/runs?per_page=${RUN_ACTIVITY_PAGE}&page=${page}`
		);
		if (!batch) break;
		total = batch.total_count;
		runs.push(...batch.workflow_runs);
		if (batch.workflow_runs.length < RUN_ACTIVITY_PAGE) break;
	}
	if (!runs.length) return EMPTY_RUN_ACTIVITY;
	const buckets = bucketOutcomes(
		runs.map((run) => ({ at: run.created_at, outcome: runOutcome(run.conclusion) }))
	);
	return { buckets, total, sampled: total > runs.length };
}

const runActivityKey = (owner: string, name: string) =>
	`repo:run-activity:v1:${owner}/${name}`.toLowerCase();

export const isRepoRunActivityCached = (owner: string, name: string) =>
	isCached(runActivityKey(owner, name));

export function getRepoRunActivity(owner: string, name: string): Promise<RepoRunActivity> {
	return cached(runActivityKey(owner, name), () => fetchRunActivity(owner, name), TTL);
}
