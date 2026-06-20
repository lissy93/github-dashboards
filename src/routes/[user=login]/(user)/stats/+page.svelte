<script lang="ts">
	import {
		CalendarDays,
		Clock,
		Sparkles,
		History,
		ChartPie,
		Code,
		Scale,
		Activity,
		Tags,
		FolderGit2,
		Trophy,
		ScatterChart,
		CircleDot,
		GitPullRequest,
		Users,
		Star,
		GitBranch
	} from '@lucide/svelte';
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
	import Panel from '$lib/components/common/Panel.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.user} stats · {APP_NAME}</title>
	<meta name="description" content="Charts and stats for {data.user} on {APP_NAME}" />
</svelte:head>

<div class="space-y-5">
	{#await data.summary}
		<Card.Root class="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 lg:grid-cols-7">
			{#each Array.from({ length: 7 }, (_, index) => index) as index (index)}
				<div class="space-y-2">
					<Skeleton class="h-3 w-16" />
					<Skeleton class="h-6 w-12" />
				</div>
			{/each}
		</Card.Root>
	{:then [overview, contributions, languages]}
		{#if overview.ok}
			<StatStrip {overview} {contributions} {languages} />
		{:else}
			<Panel title="Summary" icon={Activity} error={overview.error} />
		{/if}
	{/await}

	<div class="grid gap-5 lg:grid-cols-2 lg:items-start">
		<StarHistoryPanel user={data.user} />
		{#await data.overview}
			<Panel title="Top repos" icon={Trophy} loading />
		{:then result}
			{#if result.ok}
				<TopReposPanel user={data.user} repos={result.data.ownedRepos} />
			{:else}
				<Panel title="Top repos" icon={Trophy} error={result.error} />
			{/if}
		{/await}
	</div>

	{#if data.contributions}
		{#await data.contributions}
			<div class="grid gap-5 lg:grid-cols-3">
				<Panel class="lg:col-span-2" title="Contributions per year" icon={History} loading />
				<Panel title="By type" icon={ChartPie} loading />
			</div>
		{:then result}
			{#if result.ok}
				<ContributionsRow data={result.data} />
			{:else}
				<div class="grid gap-5 lg:grid-cols-3">
					<Panel
						class="lg:col-span-2"
						title="Contributions per year"
						icon={History}
						error={result.error}
					/>
					<Panel title="By type" icon={ChartPie} error={result.error} />
				</div>
			{/if}
		{/await}
	{/if}

	<!-- Let the shorter panels pack neatly around each other -->
	<div class="lg:columns-2 lg:gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid">
		{#if data.contributions}
			{#await data.contributions}
				<Panel title="Contribution activity" icon={CalendarDays} loading />
			{:then result}
				{#if result.ok}
					<ContributionActivity data={result.data} />
				{:else}
					<Panel title="Contribution activity" icon={CalendarDays} error={result.error} />
				{/if}
			{/await}
		{/if}

		{#if data.rhythm}
			{#await data.rhythm}
				<Panel title="Activity rhythm" icon={Clock} loading />
			{:then result}
				{#if result.ok}
					<ActivityRhythm data={result.data} />
				{:else}
					<Panel title="Activity rhythm" icon={Clock} error={result.error} />
				{/if}
			{/await}
		{/if}

		{#await data.overview}
			<Panel title="Repos created per year" icon={FolderGit2} loading />
			<Panel title="Licenses" icon={Scale} loading />
			<Panel title="Repo activity" icon={Activity} loading />
			<Panel title="Topics" icon={Tags} loading />
			<Panel title="Top languages" icon={Code} loading />
		{:then result}
			{#if result.ok}
				<RepoInsights
					repos={result.data.ownedRepos}
					languages={data.languages}
					repoLanguages={data.repoLanguages}
				/>
			{:else}
				<Panel title="Repository insights" icon={Activity} error={result.error} />
			{/if}
		{/await}
	</div>

	{#await data.overview}
		<Panel title="Portfolio" icon={ScatterChart} loading />
	{:then result}
		{#if result.ok}
			<PortfolioPanel user={data.user} repos={result.data.ownedRepos} />
		{:else}
			<Panel title="Portfolio" icon={ScatterChart} error={result.error} />
		{/if}
	{/await}

	{#await data.overview}
		<div class="grid gap-5 sm:grid-cols-2">
			<Panel title="Issues" icon={CircleDot} loading />
			<Panel title="Pull requests" icon={GitPullRequest} loading />
		</div>
	{:then result}
		{#if result.ok}
			<RepoFlowPanels user={data.user} repos={result.data.ownedRepos} />
		{:else}
			<div class="grid gap-5 sm:grid-cols-2">
				<Panel title="Issues" icon={CircleDot} error={result.error} />
				<Panel title="Pull requests" icon={GitPullRequest} error={result.error} />
			</div>
		{/if}
	{/await}

	{#if !data.isOrg}
		{#await data.overview}
			<div class="grid gap-5 lg:grid-cols-3 lg:items-start">
				<Panel title="Followers" icon={Users} loading />
				<Panel title="Latest stargazers" icon={Star} loading />
			</div>
		{:then result}
			{#if result.ok}
				<PeoplePanels user={data.user} organizations={result.data.profile.organizations} />
			{:else}
				<div class="grid gap-5 lg:grid-cols-3 lg:items-start">
					<Panel title="Followers" icon={Users} error={result.error} />
					<Panel title="Latest stargazers" icon={Star} error={result.error} />
				</div>
			{/if}
		{/await}
	{/if}

	{#await data.overview}
		<Panel title="Project lifecycles" icon={GitBranch} loading />
	{:then result}
		{#if result.ok}
			{#if data.lifecycleActivity}
				{#await data.lifecycleActivity}
					<Panel title="Project lifecycles" icon={GitBranch} loading />
				{:then activity}
					<ProjectLifecycle
						repos={result.data.ownedRepos}
						activity={activity.ok ? activity.data : undefined}
					/>
				{/await}
			{:else}
				<ProjectLifecycle repos={result.data.ownedRepos} />
			{/if}
		{:else}
			<Panel title="Project lifecycles" icon={GitBranch} error={result.error} />
		{/if}
	{/await}

	{#if data.facts}
		{#await data.facts}
			<Panel title="Fun facts" icon={Sparkles} loading />
		{:then [contributions, rhythm, languages]}
			<FunFacts {contributions} {rhythm} {languages} />
		{/await}
	{/if}
</div>
