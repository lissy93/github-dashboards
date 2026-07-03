import { compactNumber, relativeTime } from '$lib/format';
import { workflowKpiStats, formatDuration } from '$lib/views/repo';
import type { Slice } from '$lib/views/stats';
import type { RepoWorkflows } from '$lib/server/github/workflows';
import type { RepoDeployments } from '$lib/server/github/deployments';
import type { RepoPages } from '$lib/server/github/pages';
import type { RepoReleases } from '$lib/server/github/releases';
import type { SupplyChain } from '$lib/server/github/supply-chain';
import type { RepoSecurity } from '$lib/server/github/security';
import type { RepoContributors } from '$lib/server/github/contributors';
import type { RepoTrafficSummary } from '$lib/server/github/traffic';
import type { Repo } from '$lib/types';

// One-line status summaries for the ops panels, shared by the ops tab and the repo overview

export function workflowSummary(wf: RepoWorkflows): string {
	const stats = workflowKpiStats(wf);
	const parts = [`${stats.workflows} workflow${stats.workflows === 1 ? '' : 's'}`];
	if (stats.passRate != null) parts.push(`${Math.round(stats.passRate * 100)}% pass rate`);
	if (stats.avgRuntimeSec != null) parts.push(formatDuration(stats.avgRuntimeSec) + ' avg');
	return parts.join(' · ');
}

export function deploymentSummary(d: RepoDeployments): string {
	const parts = [`${compactNumber(d.totalDeployments)} deployments`];
	parts.push(`${d.environments.filter((e) => e.count > 0).length} environments`);
	if (d.lastDeployAt) parts.push(`last ${relativeTime(d.lastDeployAt)}`);
	return parts.join(' · ');
}

export function pagesSummary(p: RepoPages): string {
	if (!p.enabled) return 'Not enabled';
	const parts = [p.status === 'built' ? 'Live' : (p.status ?? 'Unknown status')];
	if (p.cname) parts.push(p.cname);
	else if (p.url) {
		try {
			parts.push(new URL(p.url).hostname);
		} catch {
			/* malformed url */
		}
	}
	return parts.join(' · ');
}

export function releasesSummary(r: RepoReleases): string {
	if (!r.releases.length) return 'No published releases';
	const latest = r.releases.at(-1)!;
	return `${compactNumber(r.total)} releases · latest ${latest.tag}`;
}

export function supplyChainSummary(sc: SupplyChain): string {
	const s = sc.summary;
	if (!s.total) return 'No dependency data';
	const parts = [`${compactNumber(s.total)} dependencies`, `${compactNumber(s.direct)} direct`];
	if (s.vulnerabilities) parts.push(`${compactNumber(s.vulnerabilities)} advisories`);
	else parts.push(`${s.ecosystems} ecosystem${s.ecosystems === 1 ? '' : 's'}`);
	return parts.join(' · ');
}

// One-line summaries for the Info tab panels

export function statsSummary(repo: Repo): string {
	const parts = [
		`${compactNumber(repo.stars)} star${repo.stars === 1 ? '' : 's'}`,
		`${compactNumber(repo.forks)} fork${repo.forks === 1 ? '' : 's'}`
	];
	if (repo.openIssues) parts.push(`${compactNumber(repo.openIssues)} open issues`);
	return parts.join(' · ');
}

export function trafficSummary(t: RepoTrafficSummary): string {
	if (!t.available) return 'No traffic data';
	return `${compactNumber(t.views.count)} views · ${compactNumber(t.views.uniques)} unique visitors`;
}

export function peopleSummary(c: RepoContributors, repo: Repo): string {
	const parts = [`${compactNumber(c.total)}${c.sampled ? '+' : ''} contributors`];
	if (repo.stars) parts.push(`${compactNumber(repo.stars)} stargazers`);
	if (repo.watchers) parts.push(`${compactNumber(repo.watchers)} watchers`);
	return parts.join(' · ');
}

export function securitySummary(sec: RepoSecurity): string {
	if (!sec.applicable) return 'No checks applicable';
	return `Grade ${sec.grade.letter} · ${sec.passed}/${sec.applicable} checks passing`;
}

// Pass/fail split of recently sampled workflow runs for the overview gauge, weighted by run
// count like the KPI strip. Null when no runs have reached a decisive conclusion yet
export function workflowGauge(wf: RepoWorkflows): { data: Slice[]; centerValue: string } | null {
	let passed = 0;
	let decisive = 0;
	for (const workflow of wf.workflows) {
		if (workflow.passRate != null && workflow.runsSampled) {
			passed += workflow.passRate * workflow.runsSampled;
			decisive += workflow.runsSampled;
		}
	}
	if (!decisive) return null;
	return {
		data: [
			{ label: 'Passed', value: Math.round(passed), color: 'var(--success)' },
			{ label: 'Failed', value: Math.round(decisive - passed), color: 'var(--danger)' }
		],
		centerValue: `${Math.round((passed / decisive) * 100)}%`
	};
}

// Recent Pages build durations (seconds) with a label per bar, oldest first so the sparkline
// reads left to right
export function pageBuildSpark(p: RepoPages, limit = 24): { values: number[]; labels: string[] } {
	const builds = p.builds
		.filter((build) => build.duration > 0)
		.slice(0, limit)
		.reverse();
	return {
		values: builds.map((build) => build.duration),
		labels: builds.map((build) => relativeTime(build.createdAt))
	};
}
