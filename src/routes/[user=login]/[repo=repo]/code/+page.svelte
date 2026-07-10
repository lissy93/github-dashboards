<script lang="ts">
	import SectionIndex, { summarize } from '$lib/components/common/SectionIndex.svelte';
	import { findPage, REPO_PAGES } from '$lib/config/pages';
	import { paths } from '$lib/config';
	import { supplyChainSummary } from '$lib/views/repo-status';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const section = findPage(REPO_PAGES, 'code')!;
	const summaries = $derived({
		'supply-chain': summarize(data.supplyChain, supplyChainSummary)
	});
</script>

<SectionIndex
	{section}
	base={paths.repo(data.user, data.repo.name)}
	scopeLabel={data.repo.nameWithOwner}
	{summaries}
/>
