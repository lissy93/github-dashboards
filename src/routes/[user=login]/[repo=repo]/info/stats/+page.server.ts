import { getRepoStarHistory } from '$lib/server/github/star-history';
import { getRepoPunchCard, getRepoRecentCommits } from '$lib/server/github/repo-metrics';
import { getRepoLanguageUsage } from '$lib/server/github/languages';
import { getRepoContributors } from '$lib/server/github/contributors';
import { getRepoReleases } from '$lib/server/github/releases';
import { getRepoLabels } from '$lib/server/github/repo-labels';
import { getRepoIssuePrTimeline } from '$lib/server/github/repo-timeline';
import { inlineReady, settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Everything streams independently, the KPI strip derives from whatever has resolved
export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const { user, repo } = params;
	return inlineReady(
		{
			stars: settle('repo-stars', getRepoStarHistory(user, repo)),
			punchCard: settle('repo-punch-card', getRepoPunchCard(user, repo)),
			languages: settle('repo-languages', getRepoLanguageUsage(user, repo)),
			contributors: settle('repo-contributors', getRepoContributors(user, repo)),
			releases: settle('repo-releases', getRepoReleases(user, repo)),
			labels: settle('repo-labels', getRepoLabels(user, repo)),
			recentCommits: settle('repo-recent-commits', getRepoRecentCommits(user, repo)),
			timeline: settle('repo-timeline', getRepoIssuePrTimeline(user, repo))
		},
		isDataRequest
	);
};
