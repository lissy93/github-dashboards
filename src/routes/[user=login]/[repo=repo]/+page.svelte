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
		Lock,
		GitGraph,
		FolderTree,
		Package
	} from '@lucide/svelte';
	import SectionHeading from '$lib/components/common/SectionHeading.svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ItemRow from '$lib/components/tasks/ItemRow.svelte';
	import RepoActivityFeed from '$lib/components/repo/RepoActivityFeed.svelte';
	import CommitGraph from '$lib/components/repo/CommitGraph.svelte';
	import MetricTimeChart from '$lib/components/analytics/MetricTimeChart.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import Sparkline from '$lib/components/charts/Sparkline.svelte';
	import RadialGauge from '$lib/components/charts/RadialGauge.svelte';
	import Treemap from '$lib/components/charts/Treemap.svelte';
	import HBarList from '$lib/components/charts/HBarList.svelte';
	import SecurityChecks from '$lib/components/repo/SecurityChecks.svelte';
	import AnalyticsDashboard from '$lib/components/analytics/AnalyticsDashboard.svelte';
	import {
		starChart,
		lifecycleBars,
		lifecycleSeries,
		cumulativeTicks,
		STAR_SAMPLED_NOTE
	} from '$lib/views/repo';
	import {
		workflowSummary,
		deploymentSummary,
		pagesSummary,
		releasesSummary,
		supplyChainSummary,
		filesSummary,
		workflowGauge,
		pageBuildSpark
	} from '$lib/views/repo-status';
	import { treeSizeSlices } from '$lib/views/repo-tree';
	import { deploymentMiniChart } from '$lib/views/repo-deployments';
	import { releaseDownloadBars, hasReleaseDownloads } from '$lib/views/repo-stats';
	import { paths, APP_NAME } from '$lib/config';
	import { findPage, REPO_PAGES } from '$lib/config/pages';
	import { iconFor } from '$lib/components/layout/nav';
	import { restrictedGate } from '$lib/config/status';
	import { progressiveTimeline } from '$lib/state/progressive.svelte';
	import { revalidatingResult } from '$lib/state/revalidate.svelte';
	import { formatBytes, formatDuration } from '$lib/utils/format';
	import type { LoadResult } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const starGate = $derived(restrictedGate('star history', !!data.viewerLogin));

	// Signed-in viewers deepen the timeline progressively
	const timeline = progressiveTimeline(() => data);

	// Freshen the SSR preview panels on land for a signed-in viewer
	const repoBase = () => `/api/${data.user}/${data.repo.name}`;
	const enabled = () => !!data.viewerLogin;
	const revalidate = <T,>(path: string, initial: () => LoadResult<T> | Promise<LoadResult<T>>) =>
		revalidatingResult({ url: () => `${repoBase()}/${path}?fresh=1`, initial, enabled });
	// tasks is open-only, the issues and prs endpoints also carry closed work
	const tasks = revalidate('tasks', () => data.tasks);
	const stars = revalidate('star-history', () => data.stars);
	const workflows = revalidate('workflows', () => data.workflows);
	const deployments = revalidate('deployments', () => data.deployments);
	const pages = revalidate('pages', () => data.pages);
	const releases = revalidate('releases', () => data.releases);
	const preview = $derived(data.preview);
	const section = (slug: string) => paths.repoSection(data.user, data.repo.name, slug);
	const code = (slug: string) => paths.repoCodeSection(data.user, data.repo.name, slug);
	const ops = (slug: string) => paths.repoOpsSection(data.user, data.repo.name, slug);
	const info = (slug: string) => paths.repoInfoSection(data.user, data.repo.name, slug);

	// Overview group headings mirror the nav tabs, so labels and icons never drift
	const heading = (slug: string) => ({
		title: findPage(REPO_PAGES, slug)?.label ?? '',
		icon: iconFor('repo', slug)
	});
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
		result={timeline.result}
		empty={(tl) => tl.points.length === 0}
		emptyText="No history yet"
		cause={timeline.cause}
		detail={timeline.detail}
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

{#snippet openList(
	kind: 'issues' | 'prs',
	title: string,
	icon: typeof CircleDot,
	emptyText: string
)}
	<AsyncPanel
		{title}
		{icon}
		{emptyText}
		href={section('tasks')}
		result={tasks.result}
		count={(t) => t[kind].total}
		capped={(t) => t[kind].capped}
		empty={(t) => t[kind].items.length === 0}
	>
		{#snippet children(t)}
			<ul class="-m-4 divide-y">
				{#each t[kind].items.slice(0, preview) as item (item.id)}
					<li><ItemRow {item} /></li>
				{/each}
			</ul>
		{/snippet}
	</AsyncPanel>
{/snippet}

<div class="space-y-6">
	<SectionHeading {...heading('tasks')}>
		<div class="grid items-start gap-5 lg:grid-cols-2">
			<div class="lg:space-y-5">
				{@render totalMini('issue', 'issues', 'Total issues', CircleDot)}
				{@render openList('issues', 'Open issues', CircleDot, 'No open issues')}
			</div>

			<div class="lg:space-y-5">
				{@render totalMini('pr', 'PRs', 'Total PRs', GitPullRequest)}
				{@render openList('prs', 'Open PRs', GitPullRequest, 'No open pull requests')}
			</div>
		</div>
	</SectionHeading>

	<SectionHeading {...heading('code')}>
		<div class="grid items-start gap-5 lg:grid-cols-2">
			<AsyncPanel title="Activity" icon={Activity} href={code('activity')} result={data.activity}>
				{#snippet children(page)}
					<RepoActivityFeed
						user={data.user}
						repo={data.repo.name}
						result={{ ok: true, data: page }}
						showFilters={false}
						showToggle={false}
						framed={false}
						limit={10}
					/>
				{/snippet}
			</AsyncPanel>

			<AsyncPanel
				title="History"
				icon={GitGraph}
				href={code('git-tree')}
				result={data.graph}
				empty={(graph) => graph.commits.length === 0}
				emptyText="No commit history yet"
			>
				{#snippet children(graph)}
					<CommitGraph
						{graph}
						repoUrl={data.repo.url}
						owner={data.repo.owner}
						repo={data.repo.name}
						limit={data.historyPreview}
					/>
				{/snippet}
			</AsyncPanel>

			<AsyncPanel
				title="Files"
				icon={FolderTree}
				href={code('files')}
				result={data.tree}
				empty={(tree) => tree.totalFiles === 0}
				emptyText="No files in this repo"
				cause={(tree) => (tree.truncated ? 'partial' : undefined)}
				detail={(tree) =>
					tree.truncated ? 'This repo is too large for the full tree, showing a subset' : undefined}
			>
				{#snippet children(tree)}
					<div class="space-y-3">
						<p class="text-sm text-muted-foreground">{filesSummary(tree)}</p>
						<Treemap data={treeSizeSlices(tree.root)} height={9} format={formatBytes} />
					</div>
				{/snippet}
			</AsyncPanel>

			<AsyncPanel
				title="Supply chain"
				icon={Package}
				href={code('supply-chain')}
				result={data.supplyChain}
				empty={(sc) => sc.summary.total === 0}
				emptyText="No dependency data"
				emptyHint="GitHub builds the dependency graph from manifest files like package.json"
			>
				{#snippet children(sc)}
					<div class="space-y-3">
						<p class="text-sm text-muted-foreground">{supplyChainSummary(sc)}</p>
						{#if sc.severities.length}
							<ul class="flex flex-wrap gap-x-3 gap-y-1 text-xs">
								{#each sc.severities as chip (chip.label)}
									<li class="flex items-center gap-1.5">
										<span
											class="size-2 rounded-full"
											style="background-color: {chip.color}"
											aria-hidden="true"
										></span>
										<span class="tabular-nums">{chip.value} {chip.label}</span>
									</li>
								{/each}
							</ul>
						{/if}
						<HBarList data={sc.risk} colored valueLabel="Packages" />
					</div>
				{/snippet}
			</AsyncPanel>
		</div>
	</SectionHeading>

	<SectionHeading {...heading('ops')}>
		<div class="grid items-start gap-5 sm:grid-cols-2">
			<AsyncPanel
				title="Workflows"
				icon={Workflow}
				href={ops('workflows')}
				result={workflows.result}
				cause={(wf) => (wf.sampled ? 'partial' : undefined)}
			>
				{#snippet children(wf)}
					{@const gauge = workflowGauge(wf)}
					<div class="space-y-3">
						<p class="text-sm text-muted-foreground">{workflowSummary(wf)}</p>
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
				result={deployments.result}
				cause={(d) => (d.sampled ? 'partial' : undefined)}
			>
				{#snippet children(d)}
					{@const freq = deploymentMiniChart(d)}
					<div class="space-y-3">
						<p class="text-sm text-muted-foreground">{deploymentSummary(d)}</p>
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
			<AsyncPanel title="Pages" icon={Globe} href={ops('pages')} result={pages.result}>
				{#snippet children(p)}
					{@const spark = pageBuildSpark(p)}
					<div class="space-y-2">
						<p class="text-sm text-muted-foreground">{pagesSummary(p)}</p>
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
								<p class="text-[0.65rem] text-muted-foreground">Recent build times</p>
							</div>
						{/if}
					</div>
				{/snippet}
			</AsyncPanel>
			<AsyncPanel
				title="Releases"
				icon={Tag}
				href={ops('releases')}
				result={releases.result}
				cause={(r) => (r.sampled ? 'partial' : undefined)}
			>
				{#snippet children(r)}
					<div class="space-y-3">
						<p class="text-sm text-muted-foreground">{releasesSummary(r)}</p>
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
	</SectionHeading>

	<SectionHeading {...heading('info')}>
		<div class="grid items-start gap-5 lg:grid-cols-2">
			<AsyncPanel
				title="Star history"
				icon={Star}
				href={info('stats')}
				result={stars.result}
				empty={(history) => history.restricted || history.days.length === 0}
				emptyText={(history) => (history.restricted ? starGate.text : 'No stars yet')}
				emptyHint={(history) => (history.restricted ? starGate.hint : undefined)}
				emptyCause={(history) => (history.restricted ? starGate.cause : 'empty')}
				cause={(history) => (history.sampled ? 'partial' : undefined)}
				detail={(history) => (history.sampled ? STAR_SAMPLED_NOTE : undefined)}
			>
				{#snippet children(history)}
					<MetricTimeChart data={starChart(history)} label="Star history" height={13} />
				{/snippet}
			</AsyncPanel>

			<AsyncPanel
				title="Security"
				icon={ShieldCheck}
				href={info('security')}
				result={data.security}
			>
				{#snippet children(security)}
					<SecurityChecks {security} />
				{/snippet}
			</AsyncPanel>
		</div>

		{#if data.canSeeTraffic}
			<Panel title="Traffic" icon={ChartArea} href={info('traffic')}>
				<AnalyticsDashboard user={data.user} repo={data.repo.name} compact />
			</Panel>
		{:else}
			<Panel
				title="Traffic"
				icon={ChartArea}
				cause="forbidden"
				detail="Only {data.user} can view repo traffic"
			>
				<EmptyState
					icon={Lock}
					text="Traffic is private"
					hint="Only {data.user} can view repo traffic"
				/>
			</Panel>
		{/if}
	</SectionHeading>
</div>
