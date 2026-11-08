<script lang="ts" module>
	// shared look for panel header links and actions
	export const PANEL_ACTION_CLASS =
		'text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring ' +
		'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ' +
		'transition-colors focus-visible:ring-1 focus-visible:outline-none';
</script>

<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { ArrowUpRight } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import Icon from '$lib/components/common/Icon.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import PanelError from '$lib/components/common/PanelError.svelte';
	import { cn } from '$lib/utils';
	import { formatNumber } from '$lib/utils/format';
	import { toDisplayError } from '$lib/utils/errors';
	import { panelCause } from '$lib/config/status';
	import { usePanelStatus } from '$lib/state/panel-status.svelte';
	import { joinPendingRetry } from '$lib/state/pending-retry.svelte';
	import type { StatusCause } from '$lib/types';

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
		cause?: StatusCause;
		detail?: string;
		silent?: boolean;
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
		cause,
		detail,
		silent = false,
		class: className,
		actions,
		children
	}: Props = $props();

	const display = $derived(error != null ? toDisplayError(error) : undefined);

	// Still warming server-side, so nudge the page load until it lands
	$effect(() => (display?.pending ? joinPendingRetry() : undefined));

	// Report this panel's settled status into the page store, so the page can summarise it
	const status = usePanelStatus();
	const uid = $props.id();
	const report = $derived({
		id: uid,
		title,
		cause: panelCause({ loading, error: display, empty, capped, cause }),
		detail: detail ?? (display && !display.pending ? display.message : undefined)
	});
	$effect(() => {
		if (status && !silent) status.set(report);
	});
	$effect(() => () => status?.remove(uid));
</script>

<Card.Root class={cn('h-full gap-0 overflow-hidden py-0', className)}>
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
								<a {...props} {href} class={PANEL_ACTION_CLASS}>
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
		{#if display}
			{#if display.pending}
				<p class="flex items-center gap-2 text-sm text-muted-foreground">
					<span class="size-2 shrink-0 animate-pulse rounded-full bg-muted-foreground/60"></span>
					{display.message}
				</p>
			{:else}
				<PanelError error={display} />
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
