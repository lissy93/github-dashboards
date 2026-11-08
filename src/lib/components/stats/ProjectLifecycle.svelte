<script lang="ts">
	import { GitBranch, ChevronDown } from '@lucide/svelte';
	import AsyncPanel from '$lib/components/common/AsyncPanel.svelte';
	import LifecycleTimeline from '$lib/components/charts/LifecycleTimeline.svelte';
	import { LIFECYCLE_GAP_MONTHS, projectLifecycles } from '$lib/views/stats';
	import { APP_NAME } from '$lib/config';
	import { cn } from '$lib/utils';
	import type { OverviewResult, LifecycleActivityResult } from '$lib/views/overview';
	import type { LoadResult, Repo, RepoActivityMonths } from '$lib/types';

	const PREVIEW = 20;

	type Payload = { repos: Repo[]; activity?: RepoActivityMonths };

	let {
		result,
		activity
	}: {
		result: Promise<OverviewResult> | OverviewResult;
		activity?: Promise<LifecycleActivityResult> | LifecycleActivityResult | null;
	} = $props();

	let expanded = $state(false);

	// Activity months are optional extra context, a miss never blocks the panel
	const combined = $derived.by(async (): Promise<LoadResult<Payload>> => {
		const overview = await result;
		if (!overview.ok) return overview;
		const months = activity ? await activity : null;
		return {
			ok: true,
			data: {
				repos: overview.data.ownedRepos,
				activity: months?.ok ? months.data : undefined
			}
		};
	});

	const lifecycles = (payload: Payload) => projectLifecycles(payload.repos, payload.activity);
</script>

<AsyncPanel
	title="Project lifecycles"
	icon={GitBranch}
	result={combined}
	empty={(payload) => !lifecycles(payload).rows.length}
	emptyText="No authored repositories yet"
>
	{#snippet actions(payload)}
		{@const rows = lifecycles(payload).rows}
		{#if rows.length > PREVIEW}
			<button
				type="button"
				class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				{expanded ? `Show top ${PREVIEW}` : `Show all ${rows.length}`}
				<ChevronDown class={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
			</button>
		{/if}
	{/snippet}
	{#snippet children(payload)}
		{@const data = lifecycles(payload)}
		<div class="flex flex-col gap-3">
			<p class="text-xs text-muted-foreground">
				Creation to last push · colour = language · dot size = stars{payload.activity
					? ` · dim = ${LIFECYCLE_GAP_MONTHS}+ months without tracked activity`
					: ''}
			</p>
			{#if payload.activity}
				<p class="text-[0.65rem] text-muted-foreground/70">
					Based on GitHub commit contributions and activity held by {APP_NAME}
				</p>
			{/if}
			<LifecycleTimeline {data} limit={expanded ? undefined : PREVIEW} />
		</div>
	{/snippet}
</AsyncPanel>
