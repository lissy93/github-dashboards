<script lang="ts">
	import {
		CircleDot,
		GitPullRequest,
		Activity,
		ShieldCheck,
		Star,
		Workflow,
		Rocket,
		Globe,
		Tag,
		ChartArea,
		Info,
		Lock
	} from '@lucide/svelte';
	import SectionHeading from '$lib/components/common/SectionHeading.svelte';
	import AsyncPanel from '$lib/components/repo/AsyncPanel.svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import RepoActivityFeed from '$lib/components/repo/RepoActivityFeed.svelte';
	import MetricTimeChart from '$lib/components/analytics/MetricTimeChart.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import Sparkline from '$lib/components/charts/Sparkline.svelte';
	import RadialGauge from '$lib/components/charts/RadialGauge.svelte';
	import SecurityChecks from '$lib/components/repo/SecurityChecks.svelte';
	import AnalyticsDashboard from '$lib/components/analytics/AnalyticsDashboard.svelte';
	import {
		starChart,
		lifecycleBars,
		lifecycleSeries,
		cumulativeTicks,
		formatDuration
	} from '$lib/views/repo';
	import {
		workflowSummary,
		deploymentSummary,
		pagesSummary,
		releasesSummary,
		workflowGauge,
		pageBuildSpark
	} from '$lib/views/repo-status';
	import { deploymentMiniChart } from '$lib/views/repo-deployments';
	import { releaseDownloadBars, hasReleaseDownloads } from '$lib/views/repo-stats';
	import { paths, APP_NAME } from '$lib/config';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const preview = $derived(data.preview);
	const section = (slug: string) => paths.repoSection(data.user, data.repo.name, slug);
	const ops = (slug: string) => paths.repoOpsSection(data.user, data.repo.name, slug);
</script>

<svelte:head>
	<title>{data.repo.nameWithOwner} · {APP_NAME}</title>
	<meta
		name="description"
		content={data.repo.description ?? `Repo health and stats for ${data.repo.nameWithOwner}`}
	/>
</svelte:head>

<!-- A short running-total chart, desktop only, sitting above its open list -->
{#snippet totalMini(kind: 'issue' | 'pr', unit: string, title: string, icon: typeof CircleDot)}
	<AsyncPanel
		{title}
		{icon}
		href={section('tasks')}
		result={data.timeline}
		empty={(tl) => tl.points.length === 0}
		emptyText="No history yet"
		class="hidden lg:block"
	>
		{#snippet children(tl)}
			<StackedBarChart
				bars={lifecycleBars(
					tl.points,
					kind,
					tl.granularity,
					kind === 'issue' ? tl.baseline.issues : tl.baseline.prs
				)}
				series={lifecycleSeries(kind)}
				totalUnit={unit}
				height={4}
				ticks={cumulativeTicks(tl.points, tl.granularity)}
				barGap={0.125}
			/>
		{/snippet}
	</AsyncPanel>
{/snippet}

<div class="space-y-6">
	<SectionHeading title="Issues & PRs" icon={GitPullRequest}>
		<div class="grid items-start gap-5 lg:grid-cols-2">
			<div class="lg:space-y-5">
				{@render totalMini('issue', 'issues', 'Total issues', CircleDot)}
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
			</div>

			<div class="lg:space-y-5">
				{@render totalMini('pr', 'PRs', 'Total PRs', GitPullRequest)}
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
		</div>
	</SectionHeading>

	<SectionHeading title="Activity & status" icon={Activity}>
		<div class="grid items-start gap-5 lg:grid-cols-2">
			<Panel title="Activity" icon={Activity} href={section('activity')}>
				<RepoActivityFeed
					user={data.user}
					repo={data.repo.name}
					result={data.activity}
					showFilters={false}
					showToggle={false}
					framed={false}
					limit={10}
				/>
			</Panel>

			<div class="space-y-5">
				<AsyncPanel
					title="Workflows"
					icon={Workflow}
					href={ops('workflows')}
					result={data.workflows}
				>
					{#snippet children(wf)}
						{@const gauge = workflowGauge(wf)}
						<div class="space-y-3">
							<p class="text-muted-foreground text-sm">{workflowSummary(wf)}</p>
							{#if gauge}
								<RadialGauge
									data={gauge.data}
									centerValue={gauge.centerValue}
									centerLabel="Pass rate"
									valueLabel="Runs"
									compact
								/>
							{/if}
						</div>
					{/snippet}
				</AsyncPanel>
				<AsyncPanel
					title="Deployments"
					icon={Rocket}
					href={ops('deployments')}
					result={data.deployments}
				>
					{#snippet children(d)}
						{@const freq = deploymentMiniChart(d)}
						<div class="space-y-3">
							<p class="text-muted-foreground text-sm">{deploymentSummary(d)}</p>
							{#if freq.bars.length >= 2}
								<StackedBarChart
									bars={freq.bars}
									series={freq.series}
									ticks={freq.ticks}
									height={3.5}
									barGap={0.125}
									totalUnit="deploys"
									miniView
								/>
							{/if}
						</div>
					{/snippet}
				</AsyncPanel>
				<AsyncPanel title="Pages" icon={Globe} href={ops('pages')} result={data.pages}>
					{#snippet children(p)}
						{@const spark = pageBuildSpark(p)}
						<div class="space-y-2">
							<p class="text-muted-foreground text-sm">{pagesSummary(p)}</p>
							{#if spark.values.length >= 3}
								<div class="space-y-1">
									<Sparkline
										values={spark.values}
										labels={spark.labels}
										valueLabel="Build time"
										format={formatDuration}
										color="var(--chart-2)"
										class="h-9"
									/>
									<p class="text-muted-foreground text-[0.65rem]">Recent build times</p>
								</div>
							{/if}
						</div>
					{/snippet}
				</AsyncPanel>
				<AsyncPanel title="Releases" icon={Tag} href={ops('releases')} result={data.releases}>
					{#snippet children(r)}
						<div class="space-y-3">
							<p class="text-muted-foreground text-sm">{releasesSummary(r)}</p>
							{#if r.releases.length >= 2 && hasReleaseDownloads(r.releases)}
								<BarChart
									data={releaseDownloadBars(r.releases)}
									color="var(--chart-4)"
									valueLabel="Downloads"
									height={3.5}
									barGap={0.125}
									maxLabels={8}
								/>
							{/if}
						</div>
					{/snippet}
				</AsyncPanel>
			</div>
		</div>
	</SectionHeading>

	<SectionHeading title="Repo info" icon={Info}>
		<div class="grid items-start gap-5 lg:grid-cols-2">
			<AsyncPanel
				title="Star history"
				icon={Star}
				href={section('stats')}
				result={data.stars}
				empty={(history) => history.days.length === 0}
				emptyText="No stars yet"
			>
				{#snippet children(history)}
					<MetricTimeChart data={starChart(history)} label="Star history" height={13} />
				{/snippet}
			</AsyncPanel>

			<AsyncPanel
				title="Security"
				icon={ShieldCheck}
				href={section('security')}
				result={data.security}
			>
				{#snippet children(security)}
					<SecurityChecks {security} slug={data.repo.nameWithOwner} />
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
	</SectionHeading>
</div>
