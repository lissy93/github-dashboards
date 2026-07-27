import { getUserOverview, isUserOverviewCached } from '$lib/server/github/user';
import { getUserContributions, isContributionsCached } from '$lib/server/github/user-stats';
import {
	getOwnedLanguages,
	getRepoLanguages,
	isLanguagesCached
} from '$lib/server/github/languages';
import {
	getActivityRhythm,
	getLifecycleActivity,
	isLifecycleActivityReady,
	isRhythmReady
} from '$lib/server/github/activity';
import { getAuthoredContributions } from '$lib/server/github/authored-contributions';
import { isAuthoredTimelineCached } from '$lib/server/github/authored-timeline';
import { settle } from '$lib/server/load';
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

export const load: PageServerLoad = async ({ params, parent }) => {
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

	// Serve cached data for SEO and stream cold misses, both language views share one cache
	const [
		overviewReady,
		languagesReady,
		contributionsReady,
		rhythmReady,
		lifecycleReady,
		authoredReady
	] = await Promise.all([
		isUserOverviewCached(user),
		isLanguagesCached(user),
		isOrg ? Promise.resolve(true) : isContributionsCached(user),
		isOrg ? Promise.resolve(true) : isRhythmReady(user),
		isOrg ? Promise.resolve(true) : isLifecycleActivityReady(user),
		isOrg ? Promise.resolve(false) : isAuthoredTimelineCached(user)
	]);

	// Reduce the authored crawl only when it is already warm, a cold crawl is heavy so the
	// signed-in viewer deepens it from the client instead of blocking the stats render
	const authored: LoadResult<AuthoredContributions> | null = isOrg
		? null
		: authoredReady
			? await settle('user-stats-authored', getAuthoredContributions(user))
			: { ok: true, data: { years: [], complete: false } };

	// The summary strip needs all three, settle them as one so it renders in one pass
	const summary = Promise.all([overview, contributions ?? Promise.resolve(null), languages]);
	const summaryReady = overviewReady && languagesReady && contributionsReady;

	// Fun facts draw on contributions, rhythm and languages, so settle them together
	const facts = contributions && rhythm ? Promise.all([contributions, rhythm, languages]) : null;
	const factsReady = contributionsReady && rhythmReady && languagesReady;

	return {
		user,
		isOrg,
		overview: overviewReady ? await overview : overview,
		languages: languagesReady ? await languages : languages,
		repoLanguages: languagesReady ? await repoLanguages : repoLanguages,
		contributions: contributions && (contributionsReady ? await contributions : contributions),
		rhythm: rhythm && (rhythmReady ? await rhythm : rhythm),
		authored,
		lifecycleActivity:
			lifecycleActivity && (lifecycleReady ? await lifecycleActivity : lifecycleActivity),
		summary: summaryReady ? await summary : summary,
		facts: facts && (factsReady ? await facts : facts)
	};
};
