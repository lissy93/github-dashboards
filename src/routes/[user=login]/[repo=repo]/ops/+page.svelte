<script lang="ts">
	import { Workflow, Rocket, Globe, Tag } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import { paths, APP_NAME } from '$lib/config';
	import {
		workflowSummary,
		deploymentSummary,
		pagesSummary,
		releasesSummary
	} from '$lib/views/repo-status';
	import type { LoadResult } from '$lib/views/overview';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const ok = <T,>(result: LoadResult<T>): T | null => (result.ok ? result.data : null);
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
