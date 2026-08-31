import type { AuthoredContributions, AuthoredRepo } from '$lib/types';
import {
	advanceAuthoredState,
	getAuthoredState,
	type AuthoredState
} from '$lib/server/github/authored-timeline';

// The year an item counts toward, taken from when it was opened
const yearOf = (iso: string) => Number(iso.slice(0, 4));

// A repo sits under the user's own namespace when the owner login matches
const isOwned = (repo: string, owner: string) =>
	repo.slice(0, repo.indexOf('/')).toLowerCase() === owner;

// Rank a year's repos by most recent contribution, then by volume, then name
const rank = (a: AuthoredRepo, b: AuthoredRepo) =>
	b.lastAt.localeCompare(a.lastAt) ||
	b.prs + b.issues - (a.prs + a.issues) ||
	a.repo.localeCompare(b.repo);

// Fold the raw authored crawl into per-year, per-repo contribution summaries. Pure, so the
// grouping maths tests apart from the GraphQL walk
export function reduceAuthored(state: AuthoredState, login: string): AuthoredContributions {
	const owner = login.toLowerCase();
	const byYear = new Map<number, Map<string, AuthoredRepo>>();
	const record = (createdAt: string, repo: string): AuthoredRepo => {
		const year = yearOf(createdAt);
		let repos = byYear.get(year);
		if (!repos) byYear.set(year, (repos = new Map()));
		let entry = repos.get(repo);
		if (!entry) {
			entry = {
				repo,
				owned: isOwned(repo, owner),
				lastAt: createdAt,
				prs: 0,
				mergedPrs: 0,
				closedPrs: 0,
				issues: 0,
				closedIssues: 0,
				additions: 0,
				deletions: 0
			};
			repos.set(repo, entry);
		}
		if (createdAt > entry.lastAt) entry.lastAt = createdAt;
		return entry;
	};

	for (const node of state.issues.nodes) {
		const entry = record(node.createdAt, node.repository.nameWithOwner);
		entry.issues += 1;
		if (node.closedAt) entry.closedIssues += 1;
	}
	for (const node of state.prs.nodes) {
		const entry = record(node.createdAt, node.repository.nameWithOwner);
		entry.prs += 1;
		if (node.merged) entry.mergedPrs += 1;
		else if (node.closedAt) entry.closedPrs += 1;
		entry.additions += node.additions;
		entry.deletions += node.deletions;
	}

	const years = [...byYear.entries()]
		.sort(([a], [b]) => b - a)
		.map(([year, repos]) => ({ year, repos: [...repos.values()].sort(rank) }));
	return { years, complete: state.issues.complete && state.prs.complete };
}

// The user's authored contributions grouped by year, served from the warm crawl
export async function getAuthoredContributions(login: string): Promise<AuthoredContributions> {
	return reduceAuthored(await getAuthoredState(login), login);
}

// One more batch of older history folded into the contributions view for a signed-in viewer
export async function advanceAuthoredContributions(login: string): Promise<AuthoredContributions> {
	return reduceAuthored(await advanceAuthoredState(login), login);
}
