<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CircleDot, GitPullRequest } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import StackedBarChart from '$lib/components/charts/StackedBarChart.svelte';
	import {
		lifecycleBars,
		lifecycleSeries,
		cumulativeTicks,
		TIMELINE_SAMPLED_NOTE
	} from '$lib/views/repo';
	import type { LoadResult, RepoTimeline, StatusCause } from '$lib/types';

	type Props = {
		result: Promise<LoadResult<RepoTimeline>> | LoadResult<RepoTimeline>;
		kind: 'issue' | 'pr';
		cause?: (tl: RepoTimeline) => StatusCause | undefined;
		detail?: (tl: RepoTimeline) => string | undefined;
		// A compact preview form: shorter bars and no sampled caption, for summary boards
		mini?: boolean;
		actions?: Snippet;
	};
	let { result, kind, cause, detail, mini = false, actions }: Props = $props();

	// Title, icon and empty copy per kind, so the same panel serves issues and PRs
	const META = {
		issue: { title: 'Total issues', icon: CircleDot, unit: 'issues', empty: 'No issues yet' },
		pr: { title: 'Total PRs', icon: GitPullRequest, unit: 'PRs', empty: 'No pull requests yet' }
	};
	const meta = $derived(META[kind]);
	const baseline = (tl: RepoTimeline) => (kind === 'issue' ? tl.baseline.issues : tl.baseline.prs);
</script>

<!-- The running total for one kind, split open/resolved/discarded and accumulated over time -->
<AsyncPanel
	title={meta.title}
	icon={meta.icon}
	{result}
	empty={(tl) => tl.points.length === 0 && baseline(tl).total === 0}
	emptyText={meta.empty}
	{cause}
	{detail}
	{actions}
>
	{#snippet children(tl)}
		<div class="space-y-3">
			<StackedBarChart
				bars={lifecycleBars(tl.points, kind, tl.granularity, baseline(tl))}
				series={lifecycleSeries(kind)}
				totalUnit={meta.unit}
				height={mini ? 4 : 14}
				ticks={cumulativeTicks(tl.points, tl.granularity)}
				barGap={0.125}
				zoom={!mini}
			/>
			{#if tl.sampled && !mini}
				<p class="text-muted-foreground text-xs">{TIMELINE_SAMPLED_NOTE}</p>
			{/if}
		</div>
	{/snippet}
</AsyncPanel>
