import type { RepoTimeline, TimelineBaseline } from '$lib/types';
import type { Lifecycle, TimelineState } from '$lib/server/github/repo-timeline';
import {
	advanceRepoTimeline,
	buildTimeline,
	repoTimelineKey,
	resolutionStats,
	timelineContribution
} from '$lib/server/github/repo-timeline';
import { getUserOverview } from '$lib/server/github/user';
import { cached, isCached, readCachedMany, writeCached } from '$lib/server/cache';
import { logError } from '$lib/utils/errors';

// Short freshness on the aggregate, the on-land ?fresh path forces a rebuild when needed
const TTL = 300;
// Repos deepened per advance, a small batch so one stuck repo never starves the rest and
// the aggregate converges in a few rounds. The client request gate caps real concurrency
const ADVANCE_REPOS = 3;
// Bump when the aggregate shape changes, to retire old entries
const key = (login: string) => `user:timeline:v1:${login.toLowerCase()}`;

type RepoRef = { owner: string; name: string; openIssues: number; openPRs: number };

const emptyBaseline = (): TimelineBaseline => ({ total: 0, open: 0 });
// Resolution histograms are a repo-only readout, so the aggregate ships empty ones
const emptyResolution = () => ({ issues: resolutionStats([]), prs: resolutionStats([]) });

// Crawl one more chunk of the first few incomplete repos, each swallowing its own failure
// (deleted, gone private or a transient error) so one bad repo never blanks or stalls the rest
async function advanceRepos(incomplete: RepoRef[]): Promise<void> {
	await Promise.all(
		incomplete.slice(0, ADVANCE_REPOS).map(async (ref) => {
			try {
				await advanceRepoTimeline(ref.owner, ref.name);
			} catch (caught) {
				logError('user-timeline-advance', caught);
			}
		})
	);
}

// The user's owned repos are the crawl set, the cheapest source of the repo list
async function ownedRefs(login: string): Promise<{ refs: RepoRef[]; capped: boolean }> {
	const overview = await getUserOverview(login);
	const refs = overview.ownedRepos.map((repo) => ({
		owner: repo.owner,
		name: repo.name,
		openIssues: repo.openIssues,
		openPRs: repo.openPRs
	}));
	return { refs, capped: overview.ownedReposCapped };
}

// Fold every owned repo's stored crawl into one all-time issue/PR timeline. A repo not yet
// crawled contributes its current open counts to the baseline, so the totals stay honest
// while its detailed history fills in over later advances. Rebuilt from the repo caches
// each time, so a repo closing an issue is never double counted
async function assemble(login: string): Promise<{ timeline: RepoTimeline; incomplete: RepoRef[] }> {
	const { refs, capped } = await ownedRefs(login);
	const states = await readCachedMany<TimelineState>(
		refs.map((ref) => repoTimelineKey(ref.owner, ref.name))
	);

	const issues: Lifecycle[] = [];
	const prs: Lifecycle[] = [];
	const baseline = { issues: emptyBaseline(), prs: emptyBaseline() };
	const incomplete: RepoRef[] = [];

	for (const ref of refs) {
		const state = states.get(repoTimelineKey(ref.owner, ref.name));
		if (!state) {
			baseline.issues.total += ref.openIssues;
			baseline.issues.open += ref.openIssues;
			baseline.prs.total += ref.openPRs;
			baseline.prs.open += ref.openPRs;
			incomplete.push(ref);
			continue;
		}
		const part = timelineContribution(state);
		issues.push(...part.issues);
		prs.push(...part.prs);
		baseline.issues.total += part.baseline.issues.total;
		baseline.issues.open += part.baseline.issues.open;
		baseline.prs.total += part.baseline.prs.total;
		baseline.prs.open += part.baseline.prs.open;
		if (!part.complete) incomplete.push(ref);
	}

	const sampled = incomplete.length > 0 || capped;
	const core = buildTimeline(issues, prs, sampled, {
		issues: baseline.issues.open,
		prs: baseline.prs.open
	});
	return { timeline: { ...core, resolution: emptyResolution(), baseline }, incomplete };
}

export const isUserTimelineCached = (login: string) => isCached(key(login));

// Serve the last aggregate instantly, rebuilding from the repo caches in the background.
// A cold user with nothing crawled seeds its top repo so the first paint shows real bars
export async function getUserIssuePrTimeline(login: string): Promise<RepoTimeline> {
	return cached(
		key(login),
		async () => {
			const { timeline, incomplete } = await assemble(login);
			if (timeline.points.length === 0 && incomplete.length) {
				await advanceRepos(incomplete);
				return (await assemble(login)).timeline;
			}
			return timeline;
		},
		TTL
	);
}

// Crawl one more incomplete repo, then rebuild and cache the aggregate, so a signed-in
// viewer deepens the all-time history one repo at a time and later viewers get the warm cache
export async function advanceUserTimeline(login: string): Promise<RepoTimeline> {
	const { timeline, incomplete } = await assemble(login);
	if (!incomplete.length) {
		await writeCached(key(login), timeline, TTL);
		return timeline;
	}
	await advanceRepos(incomplete);
	const rebuilt = await assemble(login);
	await writeCached(key(login), rebuilt.timeline, TTL);
	return rebuilt.timeline;
}
