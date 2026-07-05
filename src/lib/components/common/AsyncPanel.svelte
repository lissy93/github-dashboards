<script lang="ts" generics="T">
	import type { Component, Snippet } from 'svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import type { LoadResult, StatusCause } from '$lib/types';

	type Props = {
		title: string;
		icon?: Component<{ size?: number | string; class?: string }>;
		href?: string;
		emptyText?: string;
		emptyHint?: string;
		emptyCause?: StatusCause;
		result: Promise<LoadResult<T>> | LoadResult<T>;
		count?: (data: T) => number | undefined;
		capped?: (data: T) => boolean;
		empty?: (data: T) => boolean;
		class?: string;
		actions?: Snippet<[T]>;
		children: Snippet<[T]>;
	};
	let {
		title,
		icon,
		href,
		emptyText,
		emptyHint,
		emptyCause = 'empty',
		result,
		count,
		capped,
		empty,
		class: className,
		actions,
		children
	}: Props = $props();
</script>

{#await result}
	<Panel {title} {icon} {href} class={className} loading />
{:then res}
	{@const isEmpty = res.ok && (empty?.(res.data) ?? false)}
	{#snippet loadedActions()}
		{#if res.ok}{@render actions?.(res.data)}{/if}
	{/snippet}
	<Panel
		{title}
		{icon}
		{href}
		{emptyText}
		{emptyHint}
		class={className}
		error={res.ok ? undefined : res.error}
		count={res.ok ? count?.(res.data) : undefined}
		capped={res.ok ? (capped?.(res.data) ?? false) : false}
		empty={isEmpty}
		cause={isEmpty ? emptyCause : undefined}
		actions={res.ok && actions ? loadedActions : undefined}
	>
		{#if res.ok}
			{@render children(res.data)}
		{/if}
	</Panel>
{/await}
