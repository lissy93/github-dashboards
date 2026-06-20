<script lang="ts">
	import { GitBranch, ChevronDown } from '@lucide/svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import LifecycleTimeline from '$lib/components/charts/LifecycleTimeline.svelte';
	import { LIFECYCLE_GAP_MONTHS, projectLifecycles } from '$lib/views/stats';
	import { APP_NAME } from '$lib/config';
	import { cn } from '$lib/utils';
	import type { Repo, RepoActivityMonths } from '$lib/types';

	const PREVIEW = 20;

	let {
		repos,
		activity
	}: {
		repos: Repo[];
		activity?: RepoActivityMonths;
	} = $props();
	let expanded = $state(false);
	const data = $derived(projectLifecycles(repos, activity));
	const hidden = $derived(Math.max(0, data.rows.length - PREVIEW));
</script>

<Panel
	title="Project lifecycles"
	icon={GitBranch}
	empty={!data.rows.length}
	emptyText="No authored repositories yet"
>
	{#snippet actions()}
		{#if hidden}
			<button
				type="button"
				class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				{expanded ? 'Show top 20' : `Show all ${data.rows.length}`}
				<ChevronDown class={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
			</button>
		{/if}
	{/snippet}
	<div class="flex flex-col gap-3">
		<p class="text-muted-foreground text-xs">
			Creation to last push · colour = language · dot size = stars{activity
				? ` · dim = ${LIFECYCLE_GAP_MONTHS}+ months without tracked activity`
				: ''}
		</p>
		{#if activity}
			<p class="text-muted-foreground/70 text-[0.65rem]">
				Based on GitHub commit contributions and activity held by {APP_NAME}
			</p>
		{/if}
		<LifecycleTimeline {data} limit={expanded ? undefined : PREVIEW} />
	</div>
</Panel>
