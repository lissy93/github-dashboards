<script lang="ts">
	import SectionIndex, { summarize } from '$lib/components/common/SectionIndex.svelte';
	import { findPage, REPO_PAGES } from '$lib/config/pages';
	import { paths } from '$lib/config';
	import {
		workflowSummary,
		deploymentSummary,
		pagesSummary,
		releasesSummary
	} from '$lib/views/repo-status';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const section = findPage(REPO_PAGES, 'ops')!;
	const summaries = $derived({
		workflows: summarize(data.workflows, workflowSummary),
		deployments: summarize(data.deployments, deploymentSummary),
		pages: summarize(data.pages, pagesSummary),
		releases: summarize(data.releases, releasesSummary)
	});
</script>

<SectionIndex
	{section}
	base={paths.repo(data.user, data.repo.name)}
	scopeLabel={data.repo.nameWithOwner}
	{summaries}
/>
