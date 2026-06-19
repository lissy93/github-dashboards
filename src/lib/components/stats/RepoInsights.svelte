<script lang="ts">
	import { Code, Scale, Activity, Tags, FolderGit2 } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import Donut from '$lib/components/charts/Donut.svelte';
	import HBarList from '$lib/components/charts/HBarList.svelte';
	import TagCloud from '$lib/components/charts/TagCloud.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import {
		languageBreakdown,
		licenseBreakdown,
		repoRecency,
		reposPerYear,
		topicCloud,
		topicCount
	} from '$lib/views/stats';
	import { formatDecimal } from '$lib/format';
	import type { LanguagesResult, RepoLanguagesResult } from '$lib/views/overview';
	import type { Repo } from '$lib/types';

	let {
		repos,
		languages,
		repoLanguages
	}: {
		repos: Repo[];
		languages: Promise<LanguagesResult> | LanguagesResult;
		repoLanguages: Promise<RepoLanguagesResult> | RepoLanguagesResult;
	} = $props();

	const license = $derived(licenseBreakdown(repos));
	const recency = $derived(repoRecency(repos));
	const topics = $derived(topicCloud(repos));
	const moreTopics = $derived(topicCount(repos) - topics.length);
</script>

<!-- Repos by creation year, each one repo tall and split across its languages -->
{#await repoLanguages}
	<Panel title="Repos created per year" icon={FolderGit2} loading />
{:then result}
	{#if result.ok}
		{@const created = reposPerYear(repos, result.data)}
		<Panel title="Repos created per year" icon={FolderGit2} empty={!created.bars.length}>
			<StackedBarChart
				bars={created.bars}
				series={created.series}
				legendLimit={8}
				format={formatDecimal}
				totalUnit="repos"
			/>
		</Panel>
	{:else}
		<Panel title="Repos created per year" icon={FolderGit2} error={result.error} />
	{/if}
{/await}

<Panel title="Licenses" icon={Scale} empty={!license.length}>
	<Donut data={license} valueLabel="Repos" />
</Panel>

<Panel title="Repo activity" icon={Activity} empty={!recency.length}>
	<HBarList data={recency} colored valueLabel="Repos" />
</Panel>

<Panel title="Topics" icon={Tags} empty={!topics.length}>
	<TagCloud data={topics} more={moreTopics} />
</Panel>

<!-- Languages last, its byte fetch streams in after the repo-derived panels -->
{#await languages}
	<Panel title="Top languages" icon={Code} loading />
{:then result}
	{#if result.ok}
		<Panel title="Top languages" icon={Code} empty={!result.data.length}>
			<Donut
				data={languageBreakdown(result.data, result.data.length)}
				legend={languageBreakdown(result.data)}
				valueLabel="Bytes"
			/>
		</Panel>
	{:else}
		<Panel title="Top languages" icon={Code} error={result.error} />
	{/if}
{/await}
