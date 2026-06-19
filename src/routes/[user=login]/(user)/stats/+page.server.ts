import { getUserOverview, isUserOverviewCached } from '$lib/server/github/user';
import { getUserContributions, isContributionsCached } from '$lib/server/github/user-stats';
import {
	getOwnedLanguages,
	getRepoLanguages,
	isLanguagesCached,
	isRepoLanguagesCached
} from '$lib/server/github/languages';
import { getActivityRhythm, isRhythmReady } from '$lib/server/github/activity';
import { logError, toDisplayError } from '$lib/errors';
import type {
	OverviewResult,
	ContributionsResult,
	LanguagesResult,
	RepoLanguagesResult,
	RhythmResult
} from '$lib/views/overview';
import type { PageServerLoad } from './$types';

// Settle a fetch into a result, logging failures and carrying the error as data
function settle<T>(scope: string, task: Promise<T>) {
	return task
		.then((data) => ({ ok: true as const, data }))
		.catch((caught) => {
			logError(scope, caught);
			return { ok: false as const, error: toDisplayError(caught) };
		});
}

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

	// Render cached data server-side for SEO, stream only a slow cold miss
	const [overviewReady, languagesReady, repoLanguagesReady, contributionsReady, rhythmReady] =
		await Promise.all([
			isUserOverviewCached(user),
			isLanguagesCached(user),
			isRepoLanguagesCached(user),
			isOrg ? Promise.resolve(true) : isContributionsCached(user),
			isOrg ? Promise.resolve(true) : isRhythmReady(user)
		]);

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
		repoLanguages: repoLanguagesReady ? await repoLanguages : repoLanguages,
		contributions: contributions && (contributionsReady ? await contributions : contributions),
		rhythm: rhythm && (rhythmReady ? await rhythm : rhythm),
		summary: summaryReady ? await summary : summary,
		facts: facts && (factsReady ? await facts : facts)
	};
};
