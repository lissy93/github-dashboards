<script lang="ts" generics="T">
	import type { Component, Snippet } from 'svelte';
	import Panel from '$lib/components/common/Panel.svelte';
	import type { LoadResult, StatusCause } from '$lib/types';

	// Empty-state text and cause may depend on the data, e.g. a restricted vs truly empty list
	type OrFn<V> = V | ((data: T) => V);
	type Props = {
		title: string;
		icon?: Component<{ size?: number | string; class?: string }>;
		href?: string;
		emptyText?: OrFn<string>;
		emptyHint?: OrFn<string | undefined>;
		emptyCause?: OrFn<StatusCause>;
		result: Promise<LoadResult<T>> | LoadResult<T>;
		count?: (data: T) => number | undefined;
		capped?: (data: T) => boolean;
		// A resolved result that is still filling in, e.g. a progressively crawled dataset,
		// so the shared loading skeleton shows instead of an empty body
		loading?: (data: T) => boolean;
		empty?: (data: T) => boolean;
		cause?: (data: T) => StatusCause | undefined;
		detail?: (data: T) => string | undefined;
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
		loading,
		empty,
		cause,
		detail,
		class: className,
		actions,
		children
	}: Props = $props();

	// Resolve a value that may be a plain constant or a function of the loaded data
	const pick = <V,>(value: OrFn<V> | undefined, data: T): V | undefined =>
		typeof value === 'function' ? (value as (data: T) => V)(data) : value;
</script>

{#await result}
	<Panel {title} {icon} {href} class={className} loading />
{:then res}
	{@const isLoading = res.ok && (loading?.(res.data) ?? false)}
	{@const isEmpty = res.ok && !isLoading && (empty?.(res.data) ?? false)}
	{#snippet loadedActions()}
		{#if res.ok}{@render actions?.(res.data)}{/if}
	{/snippet}
	<Panel
		{title}
		{icon}
		{href}
		emptyText={res.ok ? pick(emptyText, res.data) : undefined}
		emptyHint={res.ok ? pick(emptyHint, res.data) : undefined}
		class={className}
		error={res.ok ? undefined : res.error}
		count={res.ok ? count?.(res.data) : undefined}
		capped={res.ok ? (capped?.(res.data) ?? false) : false}
		loading={isLoading}
		empty={isEmpty}
		cause={isEmpty && res.ok ? pick(emptyCause, res.data) : res.ok ? cause?.(res.data) : undefined}
		detail={res.ok && !isEmpty ? detail?.(res.data) : undefined}
		actions={res.ok && actions ? loadedActions : undefined}
	>
		{#if res.ok}
			{@render children(res.data)}
		{/if}
	</Panel>
{/await}
