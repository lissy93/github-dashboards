import type { RepoWorkflows, WorkflowSummary, RepoRunActivity } from '$lib/types';
import { restTolerant } from '$lib/server/github/client';
import { advanceCheckpointed, checkpointed, cached, isCached, readCached } from '$lib/server/cache';
import { mapLimit } from '$lib/server/concurrency';
import { accumulateOutcomes } from '$lib/server/github/outcome-history';
import { bucketOutcomes, type OutcomeKind } from '$lib/utils/outcomes';
import { logError } from '$lib/utils/errors';

// Runs change but not second to second, refresh on visit like the rest of the board
const TTL = 900;
// Workflows scanned and runs sampled per workflow, bounded to stay within limits
const WORKFLOWS_PER_SYNC = 20;
const LIST_PAGE = 100;
const RUN_SAMPLE = 20;
const CONCURRENCY = 6;

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
	const first = await restTolerant<{ total_count: number; workflows: RawWorkflow[] }>(
		`/repos/${owner}/${name}/actions/workflows?per_page=${LIST_PAGE}&page=1`
	);
	if (!first)
		return { metadata: [], summaries: [], runTotals: {}, totalWorkflows: 0, nextIndex: 0 };

	let metadata = mergeMetadata(current?.metadata ?? [], first.workflows);
	if (metadata.length < first.total_count) {
		const page = Math.floor(metadata.length / LIST_PAGE) + 1;
		const more = await restTolerant<{ workflows: RawWorkflow[] }>(
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
			const runs = await restTolerant<{ total_count: number; workflow_runs: RawRun[] }>(
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
export const isRepoWorkflowsCached = (owner: string, name: string) => isCached(key(owner, name));

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
	const state = await checkpointed<WorkflowState>(
		'repo-workflows',
		key(owner, name),
		TTL,
		(current) => sync(owner, name, current)
	);
	return state.totalWorkflows ? toResult(state) : EMPTY;
}

// Crawl one more batch of workflow summaries on demand and persist it, so a signed-in
// viewer can fill the table past the background bound, cached for later viewers
export async function advanceRepoWorkflows(owner: string, name: string): Promise<RepoWorkflows> {
	const stored = await readCached<WorkflowState>(key(owner, name));
	const current = stored?.value;
	if (current && !toResult(current).sampled) return toResult(current);
	const next = await advanceCheckpointed<WorkflowState>(key(owner, name), TTL, (state) =>
		sync(owner, name, state)
	);
	return next.totalWorkflows ? toResult(next) : EMPTY;
}

// Recent runs across all workflows, for the repo-wide outcome trend. Bounded to a few
// pages so a busy repo never floods the API while a quiet one still shows its full history
const RUN_ACTIVITY_PAGES = 3;
const RUN_ACTIVITY_PAGE = 100;

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
		const batch = await restTolerant<{ total_count: number; workflow_runs: RunFeedItem[] }>(
			`/repos/${owner}/${name}/actions/runs?per_page=${RUN_ACTIVITY_PAGE}&page=${page}`
		);
		if (!batch) break;
		total = batch.total_count;
		runs.push(...batch.workflow_runs);
		if (batch.workflow_runs.length < RUN_ACTIVITY_PAGE) break;
	}
	if (!runs.length) return EMPTY_RUN_ACTIVITY;
	// Accumulate the run trend across visits so it keeps history beyond the sampled window
	const buckets = await accumulateOutcomes(
		`${owner}/${name}`,
		'run-activity',
		bucketOutcomes(
			runs.map((run) => ({ at: run.created_at, outcome: runOutcome(run.conclusion) }))
		),
		total > runs.length
	);
	return { buckets, total, sampled: total > runs.length };
}

const runActivityKey = (owner: string, name: string) =>
	`repo:run-activity:v1:${owner}/${name}`.toLowerCase();

export function getRepoRunActivity(owner: string, name: string): Promise<RepoRunActivity> {
	return cached(runActivityKey(owner, name), () => fetchRunActivity(owner, name), TTL);
}
