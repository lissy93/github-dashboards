<script lang="ts">
	import { CircleDot, GitPullRequest } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import {
		lifecycleBars,
		lifecycleSeries,
		cumulativeTicks,
		TIMELINE_SAMPLED_NOTE
	} from '$lib/views/repo';
	import { APP_NAME, paths } from '$lib/config';
	import type { RepoTimeline } from '$lib/server/github/repo-timeline';
	import type { TaskList } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const section = (slug: string) => paths.repoTasksSection(data.user, data.repo.name, slug);
</script>

<svelte:head>
	<title>Issues & PRs · {data.repo.nameWithOwner} · {APP_NAME}</title>
</svelte:head>

<!-- The running total chart for one kind, split open/resolved/discarded -->
{#snippet totalChart(tl: RepoTimeline, kind: 'issue' | 'pr', unit: string)}
	<div class="space-y-3">
		<StackedBarChart
			bars={lifecycleBars(
				tl.points,
				kind,
				tl.granularity,
				kind === 'issue' ? tl.baseline.issues : tl.baseline.prs
			)}
			series={lifecycleSeries(kind)}
			totalUnit={unit}
			height={14}
			ticks={cumulativeTicks(tl.points, tl.granularity)}
			barGap={0.125}
		/>
		{#if tl.sampled}
			<p class="text-muted-foreground text-xs">{TIMELINE_SAMPLED_NOTE}</p>
		{/if}
	</div>
{/snippet}

{#snippet openList(items: TaskList['items'])}
	<ul class="-m-4 divide-y">
		{#each items as item (item.id)}
			<li><ItemRow {item} /></li>
		{/each}
	</ul>
{/snippet}

<!-- A column per kind: the running total chart on top, the live open list below -->
<div class="grid items-start gap-5 lg:grid-cols-2">
	<div class="space-y-5">
		<AsyncPanel
			title="Total issues"
			icon={CircleDot}
			result={data.timeline}
			empty={(tl) => tl.points.length === 0}
			emptyText="No issues yet"
		>
			{#snippet children(tl)}
				{@render totalChart(tl, 'issue', 'issues')}
			{/snippet}
		</AsyncPanel>

		<AsyncPanel
			title="Open issues"
			icon={CircleDot}
			href={section('issues')}
			result={data.tasks}
			count={(t) => t.issues.total}
			capped={(t) => t.issues.capped}
			empty={(t) => t.issues.items.length === 0}
			emptyText="No open issues"
		>
			{#snippet children(t)}
				{@render openList(t.issues.items)}
			{/snippet}
		</AsyncPanel>
	</div>

	<div class="space-y-5">
		<AsyncPanel
			title="Total PRs"
			icon={GitPullRequest}
			result={data.timeline}
			empty={(tl) => tl.points.length === 0}
			emptyText="No pull requests yet"
		>
			{#snippet children(tl)}
				{@render totalChart(tl, 'pr', 'PRs')}
			{/snippet}
		</AsyncPanel>

		<AsyncPanel
			title="Open PRs"
			icon={GitPullRequest}
			href={section('prs')}
			result={data.tasks}
			count={(t) => t.prs.total}
			capped={(t) => t.prs.capped}
			empty={(t) => t.prs.items.length === 0}
			emptyText="No open pull requests"
		>
			{#snippet children(t)}
				{@render openList(t.prs.items)}
			{/snippet}
		</AsyncPanel>
	</div>
</div>
