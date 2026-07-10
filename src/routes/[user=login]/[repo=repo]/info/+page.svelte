<script lang="ts">
	import SectionIndex, { summarize } from '$lib/components/common/SectionIndex.svelte';
	import { findPage, REPO_PAGES } from '$lib/config/pages';
	import { paths } from '$lib/config';
	import {
		statsSummary,
		trafficSummary,
		peopleSummary,
		securitySummary
	} from '$lib/views/repo-status';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const section = findPage(REPO_PAGES, 'info')!;
	const canTraffic = $derived(data.canSeeTraffic && data.traffic != null);

	const summaries = $derived({
		stats: summarize({ ok: true, data: data.repo }, statsSummary),
		...(canTraffic ? { traffic: summarize(data.traffic!, trafficSummary) } : {}),
		people: summarize(data.contributors, (c) => peopleSummary(c, data.repo)),
		security: summarize(data.security, securitySummary)
	});
	// Traffic is private, so non-owners see a locked card in its place
	const locked = $derived<Record<string, string>>(
		canTraffic ? {} : { traffic: `Only ${data.user} can view repo traffic` }
	);
</script>

<SectionIndex
	{section}
	base={paths.repo(data.user, data.repo.name)}
	scopeLabel={data.repo.nameWithOwner}
	{summaries}
	{locked}
/>
