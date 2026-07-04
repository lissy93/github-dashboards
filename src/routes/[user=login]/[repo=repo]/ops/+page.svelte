<script lang="ts">
	import { Workflow, Rocket, Globe, Tag } from '@lucide/svelte';
	import SummaryPanel from '$lib/components/common/SummaryPanel.svelte';
	import { paths } from '$lib/config';
	import {
		workflowSummary,
		deploymentSummary,
		pagesSummary,
		releasesSummary
	} from '$lib/views/repo-status';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();

	const section = (slug: string) => paths.repoOpsSection(data.user, data.repo.name, slug);
</script>

<PageMeta
	title={`CI/CD · ${data.repo.nameWithOwner}`}
	description={`Workflows, deployments, pages and releases for ${data.repo.nameWithOwner}`}
/>

<div class="grid gap-4 sm:grid-cols-2">
	<SummaryPanel
		title="Workflows"
		icon={Workflow}
		href={section('workflows')}
		result={data.workflows}
		summary={workflowSummary}
		fallback="Actions workflows, statuses and pass rates"
	/>
	<SummaryPanel
		title="Deployments"
		icon={Rocket}
		href={section('deployments')}
		result={data.deployments}
		summary={deploymentSummary}
		fallback="Environments, live status and deploy frequency"
	/>
	<SummaryPanel
		title="Pages"
		icon={Globe}
		href={section('pages')}
		result={data.pages}
		summary={pagesSummary}
		fallback="GitHub Pages status and build history"
	/>
	<SummaryPanel
		title="Releases"
		icon={Tag}
		href={section('releases')}
		result={data.releases}
		summary={releasesSummary}
		fallback="Releases, cadence and downloads"
	/>
</div>
