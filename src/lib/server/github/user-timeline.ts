import type { RepoTimeline, TimelineBaseline } from '$lib/types';
import type { Lifecycle, TimelineState } from '$lib/server/github/repo-timeline';
import {
	advanceRepoTimeline,
	buildTimeline,
	repoTimelineKey,
	resolutionStats,
	sweepRepoTimeline,
	timelineContribution
} from '$lib/server/github/repo-timeline';
import { getUserOverview, refreshUserOverview } from '$lib/server/github/user';
import { cached, readCachedMany, writeCached } from '$lib/server/cache';
import { logError } from '$lib/utils/errors';

// Short freshness on the aggregate, the on-land ?fresh path forces a rebuild when needed
const TTL = 300;
// Repos deepened per advance, a small batch so one stuck repo never starves the rest and
// the aggregate converges in a few rounds. The client request gate caps real concurrency
const ADVANCE_REPOS = 3;
// sweeping a complete repo is two calls, so this can run much wider than an advance
const REFRESH_REPOS = 25;
// Bump when the aggregate shape changes, to retire old entries
const key = (login: string) => `user:timeline:v1:${login.toLowerCase()}`;

type RepoRef = { owner: string; name: string; openIssues: number; openPRs: number };

const emptyBaseline = (): TimelineBaseline => ({ total: 0, open: 0 });
// Resolution histograms are a repo-only readout, so the aggregate ships empty ones
const emptyResolution = () => ({ issues: resolutionStats([]), prs: resolutionStats([]) });

// open counts moved since the crawl, so its stored lifecycle is out of date
export function hasDrifted(ref: RepoRef, state: TimelineState): boolean {
	return ref.openIssues !== state.issues.openTotal || ref.openPRs !== state.prs.openTotal;
}

// drift only earns an automatic re-sweep once that repo's last sync has aged out
export function needsResync(ref: RepoRef, state: TimelineState): boolean {
	const syncedAt = state.issues.syncedAt ?? state.prs.syncedAt;
	const stale = !syncedAt || Date.now() - Date.parse(syncedAt) >= TTL * 1000;
	return hasDrifted(ref, state) && stale;
}

// one bad repo (deleted, gone private, transient) must not stall or blank the rest
async function crawlRepos(
	refs: RepoRef[],
	limit: number,
	run: (owner: string, name: string) => Promise<unknown>
): Promise<void> {
	await Promise.all(
		refs.slice(0, limit).map(async (ref) => {
			try {
				await run(ref.owner, ref.name);
			} catch (caught) {
				logError('user-timeline-crawl', caught);
			}
		})
	);
}

const advanceRepos = (incomplete: RepoRef[]) =>
	crawlRepos(incomplete, ADVANCE_REPOS, advanceRepoTimeline);
const sweepRepos = (drifted: RepoRef[]) => crawlRepos(drifted, REFRESH_REPOS, sweepRepoTimeline);

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
// each time, so a repo closing an issue is never double counted. Repos that have drifted
// since their last sync join the incomplete set so an advance re-sweeps their lifecycle
async function assemble(
	login: string
): Promise<{ timeline: RepoTimeline; incomplete: RepoRef[]; drifted: RepoRef[] }> {
	const { refs, capped } = await ownedRefs(login);
	const states = await readCachedMany<TimelineState>(
		refs.map((ref) => repoTimelineKey(ref.owner, ref.name))
	);

	const issues: Lifecycle[] = [];
	const prs: Lifecycle[] = [];
	const baseline = { issues: emptyBaseline(), prs: emptyBaseline() };
	const incomplete: RepoRef[] = [];
	const drifted: RepoRef[] = [];

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
		if (part.complete && hasDrifted(ref, state)) drifted.push(ref);
		if (!part.complete || needsResync(ref, state)) incomplete.push(ref);
	}

	const sampled = incomplete.length > 0 || capped;
	const core = buildTimeline(issues, prs, sampled, {
		issues: baseline.issues.open,
		prs: baseline.prs.open
	});
	return { timeline: { ...core, resolution: emptyResolution(), baseline }, incomplete, drifted };
}

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

// on-demand catch-up, live counts first since drift is measured against them
export async function refreshUserTimeline(login: string): Promise<RepoTimeline> {
	await refreshUserOverview(login).catch((caught) => logError('user-timeline-refresh', caught));
	const { drifted } = await assemble(login);
	await sweepRepos(drifted);
	return advanceUserTimeline(login);
}
