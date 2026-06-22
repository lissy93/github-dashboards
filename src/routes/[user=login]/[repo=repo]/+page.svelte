<script lang="ts">
	import {
		CircleDot,
		GitPullRequest,
		Activity,
		ShieldCheck,
		Star,
		Workflow,
		ChartArea,
		Lock
	} from '@lucide/svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import ActivityItem from '$lib/components/activity/ActivityItem.svelte';
	import MetricTimeChart from '$lib/components/analytics/MetricTimeChart.svelte';
	import WorkflowTable from '$lib/components/repo/WorkflowTable.svelte';
	import ScorecardPanel from '$lib/components/repo/ScorecardPanel.svelte';
	import AnalyticsDashboard from '$lib/components/analytics/AnalyticsDashboard.svelte';
	import { timelineChart, starChart } from '$lib/views/repo';
	import { paths, APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const preview = $derived(data.preview);
	const section = (slug: string) => paths.repoSection(data.user, data.repo.name, slug);
</script>

<svelte:head>
	<title>{data.repo.nameWithOwner} · {APP_NAME}</title>
	<meta
		name="description"
		content={data.repo.description ?? `Repo health and stats for ${data.repo.nameWithOwner}`}
	/>
</svelte:head>

<div class="space-y-5">
	<div class="grid items-start gap-5 lg:grid-cols-2">
		<AsyncPanel
			title="Open issues"
			icon={CircleDot}
			href={section('tasks')}
			result={data.issues}
			count={(list) => list.total}
			capped={(list) => list.capped}
			empty={(list) => list.items.length === 0}
			emptyText="No open issues"
		>
			{#snippet children(list)}
				<ul class="-m-4 divide-y">
					{#each list.items.slice(0, preview) as item (item.id)}
						<li><ItemRow {item} /></li>
					{/each}
				</ul>
			{/snippet}
		</AsyncPanel>

		<AsyncPanel
			title="Open PRs"
			icon={GitPullRequest}
			href={section('tasks')}
			result={data.prs}
			count={(list) => list.total}
			capped={(list) => list.capped}
			empty={(list) => list.items.length === 0}
			emptyText="No open pull requests"
		>
			{#snippet children(list)}
				<ul class="-m-4 divide-y">
					{#each list.items.slice(0, preview) as item (item.id)}
						<li><ItemRow {item} /></li>
					{/each}
				</ul>
			{/snippet}
		</AsyncPanel>
	</div>

	<AsyncPanel
		title="Issues & PRs over time"
		icon={GitPullRequest}
		href={section('issues-and-prs')}
		result={data.timeline}
		empty={(tl) => tl.points.length === 0}
		emptyText="No history yet"
	>
		{#snippet children(tl)}
			<MetricTimeChart
				data={timelineChart(tl.points, ['openIssues', 'openPrs'])}
				label="Open issues and PRs over time"
			/>
		{/snippet}
	</AsyncPanel>

	<div class="grid items-start gap-5 lg:grid-cols-2">
		<AsyncPanel
			title="Activity"
			icon={Activity}
			href={section('activity')}
			result={data.activity}
			empty={(events) => events.length === 0}
			emptyText="No recent activity"
		>
			{#snippet children(events)}
				<ul class="-m-4 divide-y">
					{#each events as event (event.id)}
						<li><ActivityItem {event} /></li>
					{/each}
				</ul>
			{/snippet}
		</AsyncPanel>

		{#if data.scorecard}
			<AsyncPanel
				title="Security"
				icon={ShieldCheck}
				href={section('security')}
				result={data.scorecard}
			>
				{#snippet children(scorecard)}
					<ScorecardPanel {scorecard} />
				{/snippet}
			</AsyncPanel>
		{:else}
			<Panel title="Security" icon={ShieldCheck}>
				<EmptyState
					icon={ShieldCheck}
					text="No OpenSSF scorecard"
					hint="OpenSSF only scans public repos"
				/>
			</Panel>
		{/if}
	</div>

	<div class="grid items-start gap-5 lg:grid-cols-2">
		<AsyncPanel
			title="Star history"
			icon={Star}
			href={section('stars')}
			result={data.stars}
			empty={(history) => history.days.length === 0}
			emptyText="No stars yet"
		>
			{#snippet children(history)}
				<MetricTimeChart data={starChart(history)} label="Star history" height={13} />
			{/snippet}
		</AsyncPanel>

		<AsyncPanel
			title="Workflows"
			icon={Workflow}
			href={section('workflows')}
			result={data.workflows}
			count={(wf) => wf.workflows.length}
			empty={(wf) => wf.workflows.length === 0}
			emptyText="No workflows"
		>
			{#snippet children(wf)}
				<WorkflowTable workflows={wf.workflows.slice(0, preview)} />
			{/snippet}
		</AsyncPanel>
	</div>

	{#if data.canSeeTraffic}
		<Panel title="Traffic" icon={ChartArea} href={section('traffic')}>
			<AnalyticsDashboard user={data.user} repo={data.repo.name} compact />
		</Panel>
	{:else}
		<Panel title="Traffic" icon={ChartArea}>
			<EmptyState
				icon={Lock}
				text="Traffic is private"
				hint="Only {data.user} can view repo traffic"
			/>
		</Panel>
	{/if}
</div>
