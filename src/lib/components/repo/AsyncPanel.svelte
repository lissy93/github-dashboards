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
		class?: string;
		children: Snippet<[T]>;
	};
	let {
		title,
		icon,
		href,
		emptyText,
		result,
		count,
		capped,
		empty,
		class: className,
		children
	}: Props = $props();
</script>

{#await result}
	<Panel {title} {icon} {href} class={className} loading />
{:then res}
	<Panel
		{title}
		{icon}
		{href}
		{emptyText}
		class={className}
		count={res.ok ? count?.(res.data) : undefined}
		capped={res.ok ? (capped?.(res.data) ?? false) : false}
		empty={res.ok ? (empty?.(res.data) ?? false) : false}
	>
		{#if res.ok}
			{@render children(res.data)}
		{:else if res.error.pending}
			<p class="text-muted-foreground flex items-center gap-2 text-sm">
				<span class="bg-muted-foreground/60 size-2 shrink-0 animate-pulse rounded-full"></span>
				{res.error.message}
			</p>
		{:else}
			<p class="text-danger text-sm">{res.error.message}</p>
		{/if}
	</Panel>
{/await}
