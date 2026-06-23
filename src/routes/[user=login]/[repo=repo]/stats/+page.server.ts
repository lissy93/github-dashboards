import { getRepoStarHistory } from '$lib/server/github/star-history';
import { getRepoPunchCard, getRepoRecentCommits } from '$lib/server/github/repo-metrics';
import { getRepoLanguageUsage } from '$lib/server/github/languages';
import { getRepoReleases } from '$lib/server/github/releases';
import { getRepoContributors } from '$lib/server/github/contributors';
import { getRepoIssuePrTimeline } from '$lib/server/github/repo-timeline';
import { settle } from '$lib/server/load';
import type { PageServerLoad } from './$types';

// Everything streams independently so a slow source never blocks the page. The KPI
// strip is derived on the page from whichever sources have resolved
export const load: PageServerLoad = ({ params }) => {
	const { user, repo } = params;
	return {
		stars: settle('repo-stars', getRepoStarHistory(user, repo)),
		punchCard: settle('repo-punch-card', getRepoPunchCard(user, repo)),
		languages: settle('repo-languages', getRepoLanguageUsage(user, repo)),
		releases: settle('repo-releases', getRepoReleases(user, repo)),
		contributors: settle('repo-contributors', getRepoContributors(user, repo)),
		recentCommits: settle('repo-recent-commits', getRepoRecentCommits(user, repo)),
		timeline: settle('repo-timeline', getRepoIssuePrTimeline(user, repo))
	};
};
