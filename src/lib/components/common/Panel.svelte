<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { ArrowUpRight } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import Icon from '$lib/components/common/Icon.svelte';
	import { cn } from '$lib/utils';
	import { formatNumber } from '$lib/format';
	import { toDisplayError } from '$lib/errors';

	type Props = {
		title: string;
		icon?: Component<{ size?: number | string; class?: string }>;
		href?: string;
		count?: number;
		capped?: boolean;
		loading?: boolean;
		error?: unknown;
		empty?: boolean;
		emptyText?: string;
		class?: string;
		actions?: Snippet;
		children?: Snippet;
	};
	let {
		title,
		icon,
		href,
		count,
		capped = false,
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
									View all{#if count != null}
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
			{@render children?.()}
		{/if}
	</Card.Content>
</Card.Root>
