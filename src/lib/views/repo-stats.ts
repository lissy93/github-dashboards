import { languageBreakdown } from '$lib/views/stats';
import type { Slice } from '$lib/views/stats';
import type { LanguageUsage } from '$lib/types';
import type { ReleaseRow } from '$lib/server/github/releases';

// Language byte breakdown as donut/bar slices, reusing the user-stats shaping
export function languageSlices(usage: LanguageUsage[], limit = 8): Slice[] {
	return languageBreakdown(usage, limit);
}

// Every release as download bars, oldest first so the bars read as a timeline
export function releaseDownloadBars(releases: ReleaseRow[]): Slice[] {
	return releases.map((release) => ({
		label: release.tag,
		value: release.downloads,
		color: release.prerelease ? 'var(--muted-foreground)' : 'var(--chart-4)',
		rows: [
			{ label: 'Downloads', value: release.hasAssets ? release.downloads.toLocaleString() : 'Unknown' },
			{ label: 'Published', value: release.publishedAt.slice(0, 10) },
			...(release.prerelease ? [{ label: 'Pre-release', value: 'yes' }] : [])
		]
	}));
}

// Whether any release actually carries downloadable assets, so the page can fall
// back to a plain list when every release is source-only
export function hasReleaseDownloads(releases: ReleaseRow[]): boolean {
	return releases.some((release) => release.downloads > 0);
}

// ---- Headline KPI strip ---------------------------------------------------
// Derived on the page from sources that stream in independently, so any metric
// not yet resolved stays null and the strip shows a dash for it

export type SummaryParts = {
	totalCommits: number;
	recentCommits: number | null;
	priorCommits: number | null;
	releaseCount: number;
	contributorCount: number | null;
	contributors: { contributions: number }[] | null;
};

export type StatsSummary = {
	totalCommits: number;
	recentCommits: number | null;
	commitsDelta: number | null;
	releaseCount: number;
	contributors: number | null;
	busFactor: number | null;
	topContributorShare: number | null;
};

// Fewest contributors whose commits together clear half the total, a rough bus factor
function busFactor(contributors: { contributions: number }[]): {
	factor: number;
	topShare: number;
} {
	const counts = contributors.map((person) => person.contributions).sort((a, b) => b - a);
	const total = counts.reduce((sum, count) => sum + count, 0);
	if (!total) return { factor: 0, topShare: 0 };
	let running = 0;
	let factor = 0;
	for (const count of counts) {
		running += count;
		factor += 1;
		if (running * 2 >= total) break;
	}
	return { factor, topShare: Math.round((counts[0] / total) * 100) };
}

// Reduce the streamed datasets to the headline numbers, leaving any source that
// has not arrived yet as null. Pure, so the maths tests apart from the page
export function summariseStats(parts: SummaryParts): StatsSummary {
	const factor = parts.contributors ? busFactor(parts.contributors) : null;
	const delta =
		parts.recentCommits !== null && parts.priorCommits !== null
			? parts.recentCommits - parts.priorCommits
			: null;
	return {
		totalCommits: parts.totalCommits,
		recentCommits: parts.recentCommits,
		commitsDelta: delta,
		releaseCount: parts.releaseCount,
		contributors: parts.contributorCount,
		busFactor: factor ? factor.factor : null,
		topContributorShare: factor ? factor.topShare : null
	};
}
