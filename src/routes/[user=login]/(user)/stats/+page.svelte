<script lang="ts">
	import { ChartColumn, CalendarDays, Clock, Sparkles } from '@lucide/svelte';
	import RepoStatsSection from '$lib/components/stats/RepoStatsSection.svelte';
	import StarHistoryPanel from '$lib/components/stats/StarHistoryPanel.svelte';
	import ContributionsSection from '$lib/components/stats/ContributionsSection.svelte';
	import ContributionActivity from '$lib/components/stats/ContributionActivity.svelte';
	import ActivityRhythm from '$lib/components/stats/ActivityRhythm.svelte';
	import FunFacts from '$lib/components/stats/FunFacts.svelte';
	import StatStrip from '$lib/components/stats/StatStrip.svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
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
		<StatStrip {overview} {contributions} {languages} />
	{/await}

	<StarHistoryPanel user={data.user} />

	{#if data.contributions || data.rhythm}
		<div class="grid gap-5 lg:grid-cols-2 lg:items-start">
			{#if data.contributions}
				{#await data.contributions}
					<Panel title="Contribution activity" icon={CalendarDays} loading />
				{:then result}
					{#if result.ok}
						<ContributionActivity data={result.data} />
					{:else}
						<ErrorState error={result.error} />
					{/if}
				{/await}
			{/if}

			<div class="grid gap-5">
				{#if data.rhythm}
					{#await data.rhythm}
						<Panel title="Activity rhythm" icon={Clock} loading />
					{:then result}
						{#if result.ok}
							<ActivityRhythm data={result.data} />
						{:else}
							<ErrorState error={result.error} />
						{/if}
					{/await}
				{/if}

				{#if data.contributions}
					{#await data.contributions then result}
						{#if result.ok}
							<ContributionsSection data={result.data} />
						{/if}
					{/await}
				{/if}
			</div>
		</div>
	{/if}

	{#await data.overview}
		<div class="grid gap-5 lg:grid-cols-2">
			<Panel class="lg:col-span-2" title="Totals" icon={ChartColumn} loading />
			<Panel title="Top languages" icon={ChartColumn} loading />
			<Panel title="Top Repos" icon={ChartColumn} loading />
		</div>
	{:then result}
		{#if result.ok}
			<RepoStatsSection
				user={data.user}
				repos={result.data.ownedRepos}
				languages={data.languages}
			/>
		{:else}
			<ErrorState error={result.error} />
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
