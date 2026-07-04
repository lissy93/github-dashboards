import { getRepoStarHistory, isRepoStarHistoryCached } from '$lib/server/github/star-history';
import {
	getRepoPunchCard,
	getRepoRecentCommits,
	isRepoPunchCardCached,
	isRepoRecentCommitsCached
} from '$lib/server/github/repo-metrics';
import { getRepoLanguageUsage, isRepoLanguageUsageCached } from '$lib/server/github/languages';
import { getRepoContributors, isRepoContributorsCached } from '$lib/server/github/contributors';
import { getRepoReleases, isRepoReleasesCached } from '$lib/server/github/releases';
import { getRepoLabels, isRepoLabelsCached } from '$lib/server/github/repo-labels';
import { getRepoIssuePrTimeline, isRepoTimelineCached } from '$lib/server/github/repo-timeline';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Everything streams independently so a slow source never blocks the page, but
// cached sources render inline. The KPI strip derives from whatever has resolved
export const load: PageServerLoad = async ({ params, parent }) => {
	// the layout 404s hidden repos, so gate on it before fanning out
	await parent();
	const { user, repo } = params;
	const stars = settle('repo-stars', getRepoStarHistory(user, repo));
	const punchCard = settle('repo-punch-card', getRepoPunchCard(user, repo));
	const languages = settle('repo-languages', getRepoLanguageUsage(user, repo));
	const contributors = settle('repo-contributors', getRepoContributors(user, repo));
	const releases = settle('repo-releases', getRepoReleases(user, repo));
	const labels = settle('repo-labels', getRepoLabels(user, repo));
	const recentCommits = settle('repo-recent-commits', getRepoRecentCommits(user, repo));
	const timeline = settle('repo-timeline', getRepoIssuePrTimeline(user, repo));

	const [starsReady, punchReady, langReady, contribReady, relReady, labelReady, rcReady, tlReady] =
		await Promise.all([
			isRepoStarHistoryCached(user, repo),
			isRepoPunchCardCached(user, repo),
			isRepoLanguageUsageCached(user, repo),
			isRepoContributorsCached(user, repo),
			isRepoReleasesCached(user, repo),
			isRepoLabelsCached(user, repo),
			isRepoRecentCommitsCached(user, repo),
			isRepoTimelineCached(user, repo)
		]);

	return {
		stars: starsReady ? await stars : stars,
		punchCard: punchReady ? await punchCard : punchCard,
		languages: langReady ? await languages : languages,
		contributors: contribReady ? await contributors : contributors,
		releases: relReady ? await releases : releases,
		labels: labelReady ? await labels : labels,
		recentCommits: rcReady ? await recentCommits : recentCommits,
		timeline: tlReady ? await timeline : timeline
	};
};
