import { getRepoTasks, isRepoTasksCached } from '$lib/server/github/repo-tasks';
import { getRepoIssuePrTimeline } from '$lib/server/github/repo-timeline';
import { getActivityPage, syncRepoActivity } from '$lib/server/github/activity';
import { getRepoStarHistory } from '$lib/server/github/star-history';
import { getRepoWorkflows, isRepoWorkflowsCached } from '$lib/server/github/workflows';
import { getRepoDeployments, isRepoDeploymentsCached } from '$lib/server/github/deployments';
import { getRepoPages, isRepoPagesCached } from '$lib/server/github/pages';
import { getRepoReleases, isRepoReleasesCached } from '$lib/server/github/releases';
import { getRepoSecurity } from '$lib/server/github/security';
import { getRepoCommitGraph, isRepoCommitGraphCached } from '$lib/server/github/repo-commits';
import { getRepoTree, isRepoTreeCached } from '$lib/server/github/repo-tree';
import { getSupplyChain, isSupplyChainCached } from '$lib/server/github/supply-chain';
import { licenseRiskSlices, severitySlices } from '$lib/views/supply-chain';
import { settle } from '$lib/server/load';
import { logError } from '$lib/utils/errors';
import type { PageServerLoad } from './$types';

const PREVIEW = 6;
const ACTIVITY_PREVIEW = 10;
const HISTORY_PREVIEW = 12;

export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const owner = params.user;
	const name = params.repo;

	// Each dataset carries its error as data so one failure never breaks the rest
	const tasks = settle('repo-tasks', getRepoTasks(owner, name));
	const timeline = settle('repo-timeline', getRepoIssuePrTimeline(owner, name));
	const stars = settle('repo-stars', getRepoStarHistory(owner, name));
	const workflows = settle('repo-workflows', getRepoWorkflows(owner, name));
	const deployments = settle('repo-deployments', getRepoDeployments(owner, name));
	const pages = settle('repo-pages', getRepoPages(owner, name));
	const releases = settle('repo-releases', getRepoReleases(owner, name));
	const security = settle('repo-security', getRepoSecurity(owner, name));

	// Only the first few commits are shown, so trim the payload before it ships
	const graph = settle(
		'repo-commit-graph',
		getRepoCommitGraph(owner, name).then((full) => ({
			...full,
			commits: full.commits.slice(0, HISTORY_PREVIEW)
		}))
	);

	// The treemap only charts the top level, so nested children stay server-side
	const tree = settle(
		'repo-tree',
		getRepoTree(owner, name).then((full) => ({
			...full,
			root: full.root.map((node) => ({ ...node, children: undefined }))
		}))
	);

	// The panel shows tallies only, so the full package list stays server-side
	const supplyChain = settle(
		'supply-chain',
		getSupplyChain(owner, name).then((sc) => ({
			summary: sc.summary,
			risk: licenseRiskSlices(sc.packages),
			severities: severitySlices(sc.vulnerabilities)
		}))
	);

	// Refresh repo-wide events best-effort then read the preview, so the panel shows all
	// contributors' activity rather than only what a user-level sync happened to store.
	// Streamed (not awaited) to keep the page fast
	const activity = settle(
		'repo-activity',
		syncRepoActivity(owner, name)
			.catch((caught) => logError('repo-activity-sync', caught))
			.then(() => getActivityPage(null, { repo: `${owner}/${name}`, limit: ACTIVITY_PREVIEW }))
	);

	// Render the open lists and ops summaries inline when already cached, stream only a cold miss
	const [tasksReady, wfReady, depReady, pgReady, relReady, graphReady, treeReady, scReady] =
		await Promise.all([
			isRepoTasksCached(owner, name),
			isRepoWorkflowsCached(owner, name),
			isRepoDeploymentsCached(owner, name),
			isRepoPagesCached(owner, name),
			isRepoReleasesCached(owner, name),
			isRepoCommitGraphCached(owner, name),
			isRepoTreeCached(owner, name),
			isSupplyChainCached(owner, name)
		]);

	return {
		preview: PREVIEW,
		historyPreview: HISTORY_PREVIEW,
		tasks: tasksReady ? await tasks : tasks,
		timeline,
		stars,
		workflows: wfReady ? await workflows : workflows,
		deployments: depReady ? await deployments : deployments,
		pages: pgReady ? await pages : pages,
		releases: relReady ? await releases : releases,
		security,
		activity,
		graph: graphReady ? await graph : graph,
		tree: treeReady ? await tree : tree,
		supplyChain: scReady ? await supplyChain : supplyChain
	};
};
