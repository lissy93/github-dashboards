<script lang="ts" generics="T">
	import type { Component } from 'svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import type { LoadResult } from '$lib/types';

	// One-line preview panel for the tab root pages, linking to the full page
	type Props = {
		title: string;
		icon?: Component<{ size?: number | string; class?: string }>;
		href?: string;
		result: Promise<LoadResult<T | null>> | LoadResult<T | null>;
		summary: (data: T) => string;
		fallback?: string;
	};
	let { title, icon, href, result, summary, fallback = 'No data yet' }: Props = $props();
</script>

{#await result}
	<Panel {title} {icon} {href} loading />
{:then res}
	<Panel {title} {icon} {href} error={res.ok ? undefined : res.error}>
		{#if res.ok}
			<p class="text-muted-foreground text-sm">
				{res.data != null ? summary(res.data) : fallback}
			</p>
		{/if}
	</Panel>
{/await}
