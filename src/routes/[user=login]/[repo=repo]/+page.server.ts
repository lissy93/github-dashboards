import {
	getRepoIssues,
	getRepoPullRequests,
	isRepoTasksCached
} from '$lib/server/github/repo-tasks';
import { getRepoIssuePrTimeline } from '$lib/server/github/repo-timeline';
import { getActivityPage, syncRepoActivity } from '$lib/server/github/activity';
import { getRepoStarHistory } from '$lib/server/github/star-history';
import { getRepoWorkflows, isRepoWorkflowsCached } from '$lib/server/github/workflows';
import { getRepoDeployments, isRepoDeploymentsCached } from '$lib/server/github/deployments';
import { getRepoPages, isRepoPagesCached } from '$lib/server/github/pages';
import { getRepoReleases, isRepoReleasesCached } from '$lib/server/github/releases';
import { getRepoSecurity } from '$lib/server/github/security';
import { settle } from '$lib/server/load';
import { logError } from '$lib/errors';
import type { PageServerLoad } from './$types';

const PREVIEW = 6;
const ACTIVITY_PREVIEW = 10;

export const load: PageServerLoad = async ({ params }) => {
	const owner = params.user;
	const name = params.repo;

	// Each dataset carries its error as data so one failure never breaks the rest
	const issues = settle('repo-issues', getRepoIssues(owner, name));
	const prs = settle('repo-prs', getRepoPullRequests(owner, name));
	const timeline = settle('repo-timeline', getRepoIssuePrTimeline(owner, name));
	const stars = settle('repo-stars', getRepoStarHistory(owner, name));
	const workflows = settle('repo-workflows', getRepoWorkflows(owner, name));
	const deployments = settle('repo-deployments', getRepoDeployments(owner, name));
	const pages = settle('repo-pages', getRepoPages(owner, name));
	const releases = settle('repo-releases', getRepoReleases(owner, name));
	const security = settle('repo-security', getRepoSecurity(owner, name));

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
	const [tasksReady, wfReady, depReady, pgReady, relReady] = await Promise.all([
		isRepoTasksCached(owner, name),
		isRepoWorkflowsCached(owner, name),
		isRepoDeploymentsCached(owner, name),
		isRepoPagesCached(owner, name),
		isRepoReleasesCached(owner, name)
	]);

	return {
		preview: PREVIEW,
		issues: tasksReady ? await issues : issues,
		prs: tasksReady ? await prs : prs,
		timeline,
		stars,
		workflows: wfReady ? await workflows : workflows,
		deployments: depReady ? await deployments : deployments,
		pages: pgReady ? await pages : pages,
		releases: relReady ? await releases : releases,
		security,
		activity
	};
};
