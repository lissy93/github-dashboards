<script lang="ts" generics="T">
	import type { Component, Snippet } from 'svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import type { LoadResult } from '$lib/views/overview';

	type Props = {
		title: string;
		icon?: Component<{ size?: number | string; class?: string }>;
		href?: string;
		emptyText?: string;
		result: Promise<LoadResult<T>> | LoadResult<T>;
		count?: (data: T) => number | undefined;
		capped?: (data: T) => boolean;
		empty?: (data: T) => boolean;
		children: Snippet<[T]>;
	};
	let { title, icon, href, emptyText, result, count, capped, empty, children }: Props = $props();
</script>

{#await result}
	<Panel {title} {icon} {href} loading />
{:then res}
	<Panel
		{title}
		{icon}
		{href}
		{emptyText}
		count={res.ok ? count?.(res.data) : undefined}
		capped={res.ok ? (capped?.(res.data) ?? false) : false}
		empty={res.ok ? (empty?.(res.data) ?? false) : false}
	>
		{#if res.ok}
			{@render children(res.data)}
		{:else}
			<p class="text-danger text-sm">{res.error.message}</p>
		{/if}
	</Panel>
{/await}
