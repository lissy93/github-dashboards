<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';

	// Wrap inline content in a shadcn tooltip, renders plainly when there is no text
	let {
		text,
		class: className,
		children
	}: { text?: string; class?: string; children: Snippet } = $props();
</script>

{#if text}
	<Tooltip.Provider delayDuration={150} disableHoverableContent>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props }: { props: Record<string, unknown> })}
					<span {...props} class={cn('inline-flex items-center', className)}>
						{@render children()}
					</span>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content class="pointer-events-none">{text}</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{:else}
	<span class={cn('inline-flex items-center', className)}>{@render children()}</span>
{/if}
