<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { ArrowUpRight } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import Icon from '$lib/components/common/Icon.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { cn } from '$lib/utils';
	import { formatNumber } from '$lib/utils/format';
	import { toDisplayError } from '$lib/utils/errors';

	type Props = {
		title: string;
		icon?: Component<{ size?: number | string; class?: string }>;
		href?: string;
		linkLabel?: string;
		count?: number;
		capped?: boolean;
		loading?: boolean;
		error?: unknown;
		empty?: boolean;
		emptyText?: string;
		emptyHint?: string;
		class?: string;
		actions?: Snippet;
		children?: Snippet;
	};
	let {
		title,
		icon,
		href,
		linkLabel = 'View all',
		count,
		capped = false,
		loading = false,
		error,
		empty = false,
		emptyText = 'Nothing here yet',
		emptyHint,
		class: className,
		actions,
		children
	}: Props = $props();
</script>

<Card.Root class={cn('gap-0 overflow-hidden py-0 h-full', className)}>
	<Card.Header
		class="flex flex-row items-center justify-between gap-2 border-b px-4 py-2.5 [.border-b]:pb-2.5"
	>
		<div class="flex min-w-0 items-center gap-2">
			{#if icon}<Icon {icon} class="text-muted-foreground" />{/if}
			<Card.Title class="truncate text-sm font-medium">{title}</Card.Title>
		</div>
		<div class="flex items-center gap-1.5">
			{@render actions?.()}
			{#if href}
				<Tooltip.Provider delayDuration={150} disableHoverableContent>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props }: { props: Record<string, unknown> })}
								<a
									{...props}
									{href}
									class="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none"
								>
									{linkLabel}{#if count != null}
										<span class="tabular-nums">({formatNumber(count)}{capped ? '+' : ''})</span>
									{/if}
									<Icon icon={ArrowUpRight} size={14} />
								</a>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content class="pointer-events-none">Open {title}</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			{/if}
		</div>
	</Card.Header>
	<Card.Content class="p-4">
		{#if error}
			{@const display = toDisplayError(error)}
			{#if display.pending}
				<p class="text-muted-foreground flex items-center gap-2 text-sm">
					<span class="bg-muted-foreground/60 size-2 shrink-0 animate-pulse rounded-full"></span>
					{display.message}
				</p>
			{:else}
				<p class="text-danger text-sm">{display.message}</p>
			{/if}
		{:else if loading}
			<div class="space-y-2">
				<Skeleton class="h-4 w-2/3" />
				<Skeleton class="h-4 w-full" />
				<Skeleton class="h-4 w-1/2" />
			</div>
		{:else if empty}
			<EmptyState {icon} text={emptyText} hint={emptyHint} />
		{:else}
			{@render children?.()}
		{/if}
	</Card.Content>
</Card.Root>
