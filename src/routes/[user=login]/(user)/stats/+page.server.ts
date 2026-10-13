import { getUserOverview } from '$lib/server/github/user';
import { getUserContributions } from '$lib/server/github/user-stats';
import { getOwnedLanguages, getRepoLanguages } from '$lib/server/github/languages';
import { getActivityRhythm, getLifecycleActivity } from '$lib/server/github/activity';
import { getAuthoredContributions } from '$lib/server/github/authored-contributions';
import { isAuthoredTimelineCached } from '$lib/server/github/authored-timeline';
import { inlineReady, settle } from '$lib/server/load';
import type { AuthoredContributions, LoadResult } from '$lib/types';
import type {
	OverviewResult,
	ContributionsResult,
	LanguagesResult,
	RepoLanguagesResult,
	RhythmResult,
	LifecycleActivityResult
} from '$lib/views/overview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, isDataRequest }) => {
	const user = params.user;
	const { isOrg } = await parent();

	// Errors travel as data so one failed dataset never blanks the others
	const overview: Promise<OverviewResult> = settle('user-stats-overview', getUserOverview(user));
	const languages: Promise<LanguagesResult> = settle(
		'user-stats-languages',
		getOwnedLanguages(user)
	);
	// Per-repo language bytes power the per-year language split, fetched the same way
	const repoLanguages: Promise<RepoLanguagesResult> = settle(
		'user-stats-repo-languages',
		getRepoLanguages(user)
	);
	// Contributions and the activity rhythm are user-only, orgs get the repo charts
	const contributions: Promise<ContributionsResult> | null = isOrg
		? null
		: settle('user-stats-contributions', getUserContributions(user));
	const rhythm: Promise<RhythmResult> | null = isOrg
		? null
		: settle('user-stats-rhythm', getActivityRhythm(user));
	const lifecycleActivity: Promise<LifecycleActivityResult> | null = isOrg
		? null
		: settle('user-stats-lifecycle', getLifecycleActivity(user));

	// Reduce the authored crawl only when it is already warm, a cold crawl is heavy so the
	// signed-in viewer deepens it from the client instead of blocking the stats render
	const authored: Promise<LoadResult<AuthoredContributions>> | null = isOrg
		? null
		: isAuthoredTimelineCached(user).then((warm) =>
				warm
					? settle('user-stats-authored', getAuthoredContributions(user))
					: { ok: true, data: { years: [], complete: false } }
			);

	return inlineReady(
		{
			user,
			isOrg,
			overview,
			languages,
			repoLanguages,
			contributions,
			rhythm,
			authored,
			lifecycleActivity,
			// The summary strip needs all three, settle them as one so it renders in one pass
			summary: Promise.all([overview, contributions ?? Promise.resolve(null), languages]),
			// Fun facts draw on contributions, rhythm and languages, so settle them together
			facts: contributions && rhythm ? Promise.all([contributions, rhythm, languages]) : null
		},
		isDataRequest
	);
};
