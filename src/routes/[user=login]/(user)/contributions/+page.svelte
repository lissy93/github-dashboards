<script lang="ts">
	import { FolderGit2 } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import ContributionsList from '$lib/components/contributions/ContributionsList.svelte';
	import ContributionFilters from '$lib/components/contributions/ContributionFilters.svelte';
	import ContributionSummary from '$lib/components/contributions/ContributionSummary.svelte';
	import ContributionCharts from '$lib/components/contributions/ContributionCharts.svelte';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { APP_NAME } from '$lib/config';
	import { progressiveAuthored } from '$lib/state/progressive.svelte';
	import { defaultContributionsView } from '$lib/views/contributions';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const contributions = progressiveAuthored(() => ({
		user: data.user,
		contributions: data.result,
		viewerLogin: data.viewerLogin
	}));

	// One view for the whole page, set by the filter bar above everything it drives
	let view = $state(defaultContributionsView());
	// Fresh filters when another user's page reuses this component
	$effect(() => {
		if (data.user) view = defaultContributionsView();
	});
</script>

<PageMeta
	title={`Contributions · ${data.user}`}
	description={`Repositories ${data.user} has contributed to on ${APP_NAME}, by year`}
/>

<div class="space-y-4">
	<ContributionSummary result={contributions.result} {view} />

	<ContributionFilters result={contributions.result} bind:view />

	<ContributionCharts result={contributions.result} {view} />

	<AsyncPanel
		title="Contributions"
		icon={FolderGit2}
		result={contributions.result}
		empty={(data) => data.complete && !data.years.length}
		emptyText="No contributions found"
		cause={contributions.cause}
		detail={contributions.detail}
	>
		{#snippet children(data)}
			<ContributionsList {data} {view} />
		{/snippet}
	</AsyncPanel>
</div>
