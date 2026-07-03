import { languageBreakdown, FALLBACK_COLORS } from '$lib/views/stats';
import type { Slice } from '$lib/views/stats';
import type { LanguageUsage } from '$lib/types';
import type { ReleaseRow } from '$lib/server/github/releases';
import type { LabelCount } from '$lib/server/github/repo-labels';

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
			{
				label: 'Downloads',
				value: release.hasAssets ? release.downloads.toLocaleString() : 'Unknown'
			},
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
	totalCommits: number | null;
	recentCommits: number | null;
	priorCommits: number | null;
	releaseCount: number | null;
	contributorCount: number | null;
	contributors: { contributions: number }[] | null;
};

export type StatsSummary = {
	totalCommits: number | null;
	recentCommits: number | null;
	commitsDelta: number | null;
	releaseCount: number | null;
	contributors: number | null;
	busFactor: number | null;
	topContributorShare: number | null;
};

// Fewest of the ranked counts whose running total reaches the given share
function countForShare(countsDesc: number[], total: number, share: number): number {
	let running = 0;
	let count = 0;
	for (const value of countsDesc) {
		running += value;
		count += 1;
		if (running >= total * share) break;
	}
	return count;
}

// Fewest contributors whose commits together clear half the total, a rough bus factor
function busFactor(contributors: { contributions: number }[]): {
	factor: number;
	topShare: number;
} {
	const counts = contributors.map((person) => person.contributions).sort((a, b) => b - a);
	const total = counts.reduce((sum, count) => sum + count, 0);
	if (!total) return { factor: 0, topShare: 0 };
	return {
		factor: countForShare(counts, total, 0.5),
		topShare: Math.round((counts[0] / total) * 100)
	};
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

// ---- Contribution distribution (Lorenz curve) -----------------------------

// The 50% bus factor saturates at 1-2 on most repos, so the chart marks the more
// telling core team, the people behind the bulk of the commits
const CORE_THRESHOLD = 0.8;

export type CurvePoint = { x: number; y: number };
export type ContributionCurve = {
	points: CurvePoint[];
	gini: number;
	busFactor: number;
	coreFactor: number;
	coreThreshold: number;
	topShare: number;
	contributors: number;
};

// Gini coefficient of a value set, 0 perfectly even and 1 fully concentrated
function giniCoefficient(values: number[], total: number): number {
	const asc = [...values].sort((first, second) => first - second);
	let weighted = 0;
	for (let index = 0; index < asc.length; index++) {
		weighted += (2 * (index + 1) - asc.length - 1) * asc[index];
	}
	return total ? weighted / (asc.length * total) : 0;
}

// Cumulative share of commits held by the top contributors, with a Gini coefficient
// and the core team marker. Pure, so the concentration maths tests apart from the page
export function contributionCurve(
	contributors: { contributions: number }[]
): ContributionCurve | null {
	const counts = contributors.map((person) => person.contributions).filter((count) => count > 0);
	if (counts.length < 2) return null;
	const total = counts.reduce((sum, count) => sum + count, 0);
	const desc = [...counts].sort((first, second) => second - first);
	const points: CurvePoint[] = [{ x: 0, y: 0 }];
	let running = 0;
	for (let index = 0; index < desc.length; index++) {
		running += desc[index];
		points.push({ x: (index + 1) / desc.length, y: running / total });
	}
	const { factor, topShare } = busFactor(contributors);
	return {
		points,
		gini: giniCoefficient(desc, total),
		busFactor: factor,
		coreFactor: countForShare(desc, total, CORE_THRESHOLD),
		coreThreshold: CORE_THRESHOLD,
		topShare,
		contributors: desc.length
	};
}

// ---- Release cadence ------------------------------------------------------

export type ReleaseMarker = {
	tag: string;
	date: string;
	time: number;
	prerelease: boolean;
	gapDays: number | null;
};
export type ReleaseCadence = { markers: ReleaseMarker[]; medianGapDays: number | null };

// Middle value of a set, averaging the two middles for an even count
function medianOf(values: number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((first, second) => first - second);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// Releases on a real time axis, each carrying the gap since the previous one, plus
// the median cadence. Releases arrive oldest first so the gaps read forward in time
export function releaseCadence(releases: ReleaseRow[]): ReleaseCadence {
	const markers: ReleaseMarker[] = [];
	const gaps: number[] = [];
	let previous: number | null = null;
	for (const release of releases) {
		if (!release.publishedAt) continue;
		const time = Date.parse(release.publishedAt);
		const gapDays = previous === null ? null : Math.round((time - previous) / 86400000);
		if (gapDays !== null) gaps.push(gapDays);
		markers.push({
			tag: release.tag,
			date: release.publishedAt.slice(0, 10),
			time,
			prerelease: release.prerelease,
			gapDays
		});
		previous = time;
	}
	return { markers, medianGapDays: medianOf(gaps) };
}

// ---- Label work-mix -------------------------------------------------------

// Labels as treemap tiles sized by usage, filled with their own GitHub colour or a fallback
export function labelTreemap(labels: LabelCount[], limit = 16): Slice[] {
	return labels.slice(0, limit).map((label, index) => ({
		label: label.name,
		value: label.total,
		color: label.color ? `#${label.color}` : FALLBACK_COLORS[index % FALLBACK_COLORS.length],
		rows: [
			{ label: 'Issues', value: label.issues.toLocaleString() },
			{ label: 'PRs', value: label.prs.toLocaleString() }
		]
	}));
}
