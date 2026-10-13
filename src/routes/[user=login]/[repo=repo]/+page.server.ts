import { getRepoTasks } from '$lib/server/github/repo-tasks';
import { getRepoIssuePrTimeline } from '$lib/server/github/repo-timeline';
import { getActivityPage, syncRepoActivity } from '$lib/server/github/activity';
import { getRepoStarHistory } from '$lib/server/github/star-history';
import { getRepoWorkflows } from '$lib/server/github/workflows';
import { getRepoDeployments } from '$lib/server/github/deployments';
import { getRepoPages } from '$lib/server/github/pages';
import { getRepoReleases } from '$lib/server/github/releases';
import { getRepoSecurity } from '$lib/server/github/security';
import { getRepoCommitGraph } from '$lib/server/github/repo-commits';
import { getRepoTree } from '$lib/server/github/repo-tree';
import { getSupplyChain } from '$lib/server/github/supply-chain';
import { licenseRiskSlices, severitySlices } from '$lib/views/supply-chain';
import { inlineReady, settle } from '$lib/server/load';
import { logError } from '$lib/utils/errors';
import type { PageServerLoad } from './$types';

const PREVIEW = 6;
const ACTIVITY_PREVIEW = 10;
const HISTORY_PREVIEW = 12;

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
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
	// contributors' activity rather than only what a user-level sync happened to store
	const activity = settle(
		'repo-activity',
		syncRepoActivity(owner, name)
			.catch((caught) => logError('repo-activity-sync', caught))
			.then(() => getActivityPage(null, { repo: `${owner}/${name}`, limit: ACTIVITY_PREVIEW }))
	);

	return inlineReady(
		{
			preview: PREVIEW,
			historyPreview: HISTORY_PREVIEW,
			tasks,
			timeline,
			stars,
			workflows,
			deployments,
			pages,
			releases,
			security,
			activity,
			graph,
			tree,
			supplyChain
		},
		isDataRequest
	);
};
