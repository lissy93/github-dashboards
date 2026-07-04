<script lang="ts">
	import { Code, Scale, Activity, Tags, FolderGit2 } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
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
	import { combineResults } from '$lib/state/api';
	import { formatDecimal } from '$lib/utils/format';
	import type { OverviewResult, LanguagesResult, RepoLanguagesResult } from '$lib/views/overview';

	let {
		result,
		languages,
		repoLanguages
	}: {
		result: Promise<OverviewResult> | OverviewResult;
		languages: Promise<LanguagesResult> | LanguagesResult;
		repoLanguages: Promise<RepoLanguagesResult> | RepoLanguagesResult;
	} = $props();

	// The per-year split needs both the repo list and per-repo language bytes
	const perYear = $derived(combineResults(result, repoLanguages));
</script>

<AsyncPanel
	title="Repos created per year"
	icon={FolderGit2}
	result={perYear}
	empty={([overview, langs]) => !reposPerYear(overview.ownedRepos, langs).bars.length}
>
	{#snippet children([overview, langs])}
		{@const created = reposPerYear(overview.ownedRepos, langs)}
		<StackedBarChart
			bars={created.bars}
			series={created.series}
			legendLimit={8}
			format={formatDecimal}
			totalUnit="repos"
		/>
	{/snippet}
</AsyncPanel>

<AsyncPanel
	title="Licenses"
	icon={Scale}
	{result}
	empty={(data) => !licenseBreakdown(data.ownedRepos).length}
>
	{#snippet children(data)}
		<Donut data={licenseBreakdown(data.ownedRepos)} valueLabel="Repos" />
	{/snippet}
</AsyncPanel>

<AsyncPanel
	title="Repo activity"
	icon={Activity}
	{result}
	empty={(data) => !repoRecency(data.ownedRepos).length}
>
	{#snippet children(data)}
		<HBarList data={repoRecency(data.ownedRepos)} colored valueLabel="Repos" />
	{/snippet}
</AsyncPanel>

<AsyncPanel
	title="Topics"
	icon={Tags}
	{result}
	empty={(data) => !topicCloud(data.ownedRepos).length}
>
	{#snippet children(data)}
		{@const topics = topicCloud(data.ownedRepos)}
		<TagCloud data={topics} more={topicCount(data.ownedRepos) - topics.length} />
	{/snippet}
</AsyncPanel>

<!-- Languages last, its byte fetch streams in after the repo-derived panels -->
<AsyncPanel title="Top languages" icon={Code} result={languages} empty={(data) => !data.length}>
	{#snippet children(data)}
		<Donut
			data={languageBreakdown(data, data.length)}
			legend={languageBreakdown(data)}
			valueLabel="Bytes"
		/>
	{/snippet}
</AsyncPanel>
