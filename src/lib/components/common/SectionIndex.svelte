<script lang="ts" module>
	import type { LoadResult } from '$lib/types';

	export type SummaryHook = {
		result: Promise<LoadResult<unknown>> | LoadResult<unknown>;
		summary: (data: unknown) => string;
		fallback?: string;
	};

	// Tie a load result to its summariser so pages can hook live data by child slug
	export function summarize<T>(
		result: Promise<LoadResult<T | null>> | LoadResult<T | null>,
		summary: (data: T) => string,
		fallback?: string
	): SummaryHook {
		return {
			result: result as SummaryHook['result'],
			summary: summary as SummaryHook['summary'],
			fallback
		};
	}
</script>

<script lang="ts">
	import Panel from '$lib/components/common/Panel.svelte';
	import SummaryPanel from '$lib/components/common/SummaryPanel.svelte';
	import PageMeta from '$lib/components/common/PageMeta.svelte';
	import { iconFor } from '$lib/components/layout/nav';
	import { pageHref, type PageDef } from '$lib/config/pages';

	// Registry-driven grid of a section's sub-pages, each linking through to its full page
	let {
		section,
		base,
		scopeLabel,
		scope = 'repo',
		summaries = {},
		locked = {}
	}: {
		section: PageDef;
		base: string;
		scopeLabel: string;
		scope?: 'user' | 'repo';
		summaries?: Record<string, SummaryHook>;
		locked?: Record<string, string>;
	} = $props();
</script>

<PageMeta title={`${section.label} · ${scopeLabel}`} description={section.description} />

<div class="grid gap-4 sm:grid-cols-2">
	{#each section.children ?? [] as child (child.slug)}
		{@const icon = iconFor(scope, section.slug, child.slug)}
		{#if locked[child.slug]}
			<Panel title={child.label} {icon} cause="forbidden" detail={locked[child.slug]}>
				<p class="text-sm text-muted-foreground">{locked[child.slug]}</p>
			</Panel>
		{:else if summaries[child.slug]}
			<SummaryPanel
				title={child.label}
				{icon}
				href={pageHref(base, section.slug, child.slug)}
				result={summaries[child.slug].result}
				summary={summaries[child.slug].summary}
				fallback={summaries[child.slug].fallback ?? child.description}
				description={child.description}
			/>
		{:else}
			<Panel title={child.label} {icon} href={pageHref(base, section.slug, child.slug)}>
				<p class="text-sm text-muted-foreground">{child.description}</p>
			</Panel>
		{/if}
	{/each}
</div>
