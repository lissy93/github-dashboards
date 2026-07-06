<script lang="ts">
	import StarHistoryPanel from '$lib/components/stats/StarHistoryPanel.svelte';
	import ActivityRhythm from '$lib/components/stats/ActivityRhythm.svelte';
	import ContributionsRow from '$lib/components/stats/ContributionsRow.svelte';
	import ContributionActivity from '$lib/components/stats/ContributionActivity.svelte';
	import TopReposPanel from '$lib/components/stats/TopReposPanel.svelte';
	import RepoInsights from '$lib/components/stats/RepoInsights.svelte';
	import RepoFlowPanels from '$lib/components/stats/RepoFlowPanels.svelte';
	import PeoplePanels from '$lib/components/stats/PeoplePanels.svelte';
	import PortfolioPanel from '$lib/components/stats/PortfolioPanel.svelte';
	import FunFacts from '$lib/components/stats/FunFacts.svelte';
	import StatStrip from '$lib/components/stats/StatStrip.svelte';
	import ProjectLifecycle from '$lib/components/stats/ProjectLifecycle.svelte';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';
	import PageMeta from '$lib/components/common/PageMeta.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PageMeta
	title={`${data.user} stats`}
	description={`Charts and stats for ${data.user} on ${APP_NAME}`}
/>

<div class="space-y-5">
	<StatStrip result={data.summary} />

	<div class="grid gap-5 lg:grid-cols-2 lg:items-start">
		<StarHistoryPanel user={data.user} loggedIn={!!data.viewerLogin} />
		<TopReposPanel user={data.user} result={data.overview} />
	</div>

	{#if data.contributions}
		<ContributionsRow result={data.contributions} />
	{/if}

	<!-- Let the shorter panels pack neatly around each other -->
	<div class="lg:columns-2 lg:gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid">
		{#if data.contributions}
			<ContributionActivity result={data.contributions} />
		{/if}

		{#if data.rhythm}
			<ActivityRhythm result={data.rhythm} />
		{/if}

		<RepoInsights
			result={data.overview}
			languages={data.languages}
			repoLanguages={data.repoLanguages}
		/>
	</div>

	<PortfolioPanel user={data.user} result={data.overview} />

	<RepoFlowPanels user={data.user} result={data.overview} />

	{#if !data.isOrg}
		<PeoplePanels user={data.user} result={data.overview} />
	{/if}

	<ProjectLifecycle result={data.overview} activity={data.lifecycleActivity} />

	{#if data.facts}
		<FunFacts result={data.facts} />
	{/if}
</div>
