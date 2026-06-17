<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { ArrowUpRight } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import Icon from '$lib/components/common/Icon.svelte';
	import { cn } from '$lib/utils';
	import { toDisplayError } from '$lib/errors';

	type Props = {
		title: string;
		icon?: Component<{ size?: number | string; class?: string }>;
		href?: string;
		loading?: boolean;
		error?: unknown;
		empty?: boolean;
		emptyText?: string;
		class?: string;
		actions?: Snippet;
		children: Snippet;
	};
	let {
		title,
		icon,
		href,
		loading = false,
		error,
		empty = false,
		emptyText = 'Nothing here yet',
		class: className,
		actions,
		children
	}: Props = $props();
</script>

<Card.Root class={cn('gap-0 overflow-hidden py-0', className)}>
	<Card.Header
		class="flex flex-row items-center justify-between gap-2 border-b px-4 py-2.5 [.border-b]:pb-2.5"
	>
		<div class="flex min-w-0 items-center gap-2">
			{#if icon}<Icon {icon} class="text-muted-foreground" />{/if}
			<Card.Title class="truncate text-sm font-medium">{title}</Card.Title>
		</div>
		<div class="flex items-center gap-1">
			{@render actions?.()}
			{#if href}
				<a
					{href}
					aria-label="Open {title}"
					class="text-muted-foreground hover:text-foreground rounded-sm p-1 transition-colors"
				>
					<Icon icon={ArrowUpRight} />
				</a>
			{/if}
		</div>
	</Card.Header>
	<Card.Content class="p-4">
		{#if error}
			<p class="text-danger text-sm">{toDisplayError(error).message}</p>
		{:else if loading}
			<div class="space-y-2">
				<Skeleton class="h-4 w-2/3" />
				<Skeleton class="h-4 w-full" />
				<Skeleton class="h-4 w-1/2" />
			</div>
		{:else if empty}
			<p class="text-muted-foreground text-sm">{emptyText}</p>
		{:else}
			{@render children()}
		{/if}
	</Card.Content>
</Card.Root>
