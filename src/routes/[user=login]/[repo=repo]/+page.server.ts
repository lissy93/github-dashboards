import {
	getRepoIssues,
	getRepoPullRequests,
	isRepoTasksCached
} from '$lib/server/github/repo-tasks';
import { getRepoIssuePrTimeline } from '$lib/server/github/repo-timeline';
import { getActivityPage } from '$lib/server/github/activity';
import { getRepoStarHistory } from '$lib/server/github/star-history';
import { getRepoWorkflows } from '$lib/server/github/workflows';
import { getRepoSecurity } from '$lib/server/github/security';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

const PREVIEW = 6;

export const load: PageServerLoad = async ({ params }) => {
	const owner = params.user;
	const name = params.repo;

	// Each dataset carries its error as data so one failure never breaks the rest
	const issues = settle('repo-issues', getRepoIssues(owner, name));
	const prs = settle('repo-prs', getRepoPullRequests(owner, name));
	const timeline = settle('repo-timeline', getRepoIssuePrTimeline(owner, name));
	const stars = settle('repo-stars', getRepoStarHistory(owner, name));
	const workflows = settle('repo-workflows', getRepoWorkflows(owner, name));
	const security = settle('repo-security', getRepoSecurity(owner, name));

	// Activity is a quick store read, resolve it inline and never block on GitHub here
	const activity = await settle(
		'repo-activity',
		getActivityPage(null, { repo: `${owner}/${name}`, limit: PREVIEW }).then((page) => page.events)
	);

	// Render the open lists inline when already cached, stream only a cold miss
	const tasksReady = await isRepoTasksCached(owner, name);

	return {
		preview: PREVIEW,
		issues: tasksReady ? await issues : issues,
		prs: tasksReady ? await prs : prs,
		timeline,
		stars,
		workflows,
		security,
		activity
	};
};
