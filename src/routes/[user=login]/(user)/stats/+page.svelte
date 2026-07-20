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
	import { revalidatingResult } from '$lib/state/revalidate.svelte';

	let { data }: { data: PageData } = $props();

	// Freshen the SSR panels on land for a signed-in viewer
	const enabled = () => !!data.viewerLogin;
	const overview = revalidatingResult({
		url: () => `/api/${data.user}/overview?fresh=1`,
		initial: () => data.overview,
		enabled
	});
	const languages = revalidatingResult({
		url: () => `/api/${data.user}/languages?fresh=1`,
		initial: () => data.languages,
		enabled
	});
	const repoLanguages = revalidatingResult({
		url: () => `/api/${data.user}/repo-languages?fresh=1`,
		initial: () => data.repoLanguages,
		enabled
	});
	// User-only datasets, their initial data is only read when the page renders them
	const userOnly = () => !!data.viewerLogin && !data.isOrg;
	const contributions = revalidatingResult({
		url: () => `/api/${data.user}/contributions?fresh=1`,
		initial: () => data.contributions!,
		enabled: userOnly
	});
	const rhythm = revalidatingResult({
		url: () => `/api/${data.user}/rhythm?fresh=1`,
		initial: () => data.rhythm!,
		enabled: userOnly
	});
	const lifecycle = revalidatingResult({
		url: () => `/api/${data.user}/lifecycle?fresh=1`,
		initial: () => data.lifecycleActivity!,
		enabled: userOnly
	});

	// The combos keep the SSR-ready value until a fresh part lands, then rebuild live
	const summary = $derived(
		overview.refreshed || contributions.refreshed || languages.refreshed
			? Promise.all([
					overview.result,
					data.contributions ? contributions.result : null,
					languages.result
				])
			: data.summary
	);
	const facts = $derived(
		data.facts && (contributions.refreshed || rhythm.refreshed || languages.refreshed)
			? Promise.all([contributions.result, rhythm.result, languages.result])
			: data.facts
	);
</script>

<PageMeta
	title={`${data.user} stats`}
	description={`Charts and stats for ${data.user} on ${APP_NAME}`}
/>

<div class="space-y-5">
	<StatStrip result={summary} />

	<div class="grid gap-5 lg:grid-cols-2 lg:items-start">
		<StarHistoryPanel user={data.user} loggedIn={!!data.viewerLogin} />
		<TopReposPanel user={data.user} result={overview.result} />
	</div>

	{#if data.contributions}
		<ContributionsRow result={contributions.result} />
	{/if}

	<!-- Let the shorter panels pack neatly around each other -->
	<div class="lg:columns-2 lg:gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid">
		{#if data.contributions}
			<ContributionActivity result={contributions.result} />
		{/if}

		{#if data.rhythm}
			<ActivityRhythm result={rhythm.result} />
		{/if}

		<RepoInsights
			result={overview.result}
			languages={languages.result}
			repoLanguages={repoLanguages.result}
		/>
	</div>

	<PortfolioPanel user={data.user} result={overview.result} />

	<RepoFlowPanels user={data.user} result={overview.result} />

	{#if !data.isOrg}
		<PeoplePanels user={data.user} result={overview.result} />
	{/if}

	<ProjectLifecycle
		result={overview.result}
		activity={data.lifecycleActivity ? lifecycle.result : null}
	/>

	{#if facts}
		<FunFacts result={facts} />
	{/if}
</div>
