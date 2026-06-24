<script lang="ts">
	import { Workflow, Rocket, Globe, Tag } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import { paths, APP_NAME } from '$lib/config';
	import { compactNumber, relativeTime } from '$lib/format';
	import { workflowKpiStats, formatDuration } from '$lib/views/repo';
	import type { RepoWorkflows } from '$lib/server/github/workflows';
	import type { RepoDeployments } from '$lib/server/github/deployments';
	import type { RepoPages } from '$lib/server/github/pages';
	import type { RepoReleases } from '$lib/server/github/releases';
	import type { LoadResult } from '$lib/views/overview';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const ok = <T,>(result: LoadResult<T>): T | null => (result.ok ? result.data : null);

	function workflowSummary(wf: RepoWorkflows): string {
		const stats = workflowKpiStats(wf);
		const parts = [`${stats.workflows} workflow${stats.workflows === 1 ? '' : 's'}`];
		if (stats.passRate != null) parts.push(`${Math.round(stats.passRate * 100)}% pass rate`);
		if (stats.avgRuntimeSec != null) parts.push(formatDuration(stats.avgRuntimeSec) + ' avg');
		return parts.join(' · ');
	}

	function deploymentSummary(d: RepoDeployments): string {
		const parts = [`${compactNumber(d.totalDeployments)} deployments`];
		parts.push(`${d.environments.filter((e) => e.count > 0).length} environments`);
		if (d.lastDeployAt) parts.push(`last ${relativeTime(d.lastDeployAt)}`);
		return parts.join(' · ');
	}

	function pagesSummary(p: RepoPages): string {
		if (!p.enabled) return 'Not enabled';
		const parts = [p.status === 'built' ? 'Live' : (p.status ?? 'Unknown status')];
		if (p.cname) parts.push(p.cname);
		else if (p.url) {
			try { parts.push(new URL(p.url).hostname); } catch { /* malformed url */ }
		}
		return parts.join(' · ');
	}

	function releasesSummary(r: RepoReleases): string {
		if (!r.releases.length) return 'No published releases';
		const latest = r.releases.at(-1)!;
		return `${compactNumber(r.total)} releases · latest ${latest.tag}`;
	}
</script>

<svelte:head>
	<title>CI/CD · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<div class="grid gap-4 sm:grid-cols-2">
	{#await data.workflows then res}
		{@const wf = ok(res)}
		<Panel
			title="Workflows"
			icon={Workflow}
			href={paths.repoOpsSection(data.user, data.repo.name, 'workflows')}
		>
			<p class="text-muted-foreground text-sm">
				{wf ? workflowSummary(wf) : 'Loading...'}
			</p>
		</Panel>
	{/await}

	{#await data.deployments then res}
		{@const d = ok(res)}
		<Panel
			title="Deployments"
			icon={Rocket}
			href={paths.repoOpsSection(data.user, data.repo.name, 'deployments')}
		>
			<p class="text-muted-foreground text-sm">
				{d ? deploymentSummary(d) : 'Loading...'}
			</p>
		</Panel>
	{/await}

	{#await data.pages then res}
		{@const p = ok(res)}
		<Panel
			title="Pages"
			icon={Globe}
			href={paths.repoOpsSection(data.user, data.repo.name, 'pages')}
		>
			<p class="text-muted-foreground text-sm">
				{p ? pagesSummary(p) : 'Loading...'}
			</p>
		</Panel>
	{/await}

	{#await data.releases then res}
		{@const r = ok(res)}
		<Panel
			title="Releases"
			icon={Tag}
			href={paths.repoOpsSection(data.user, data.repo.name, 'releases')}
		>
			<p class="text-muted-foreground text-sm">
				{r ? releasesSummary(r) : 'Loading...'}
			</p>
		</Panel>
	{/await}
</div>
