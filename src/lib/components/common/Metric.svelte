<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import Icon from '$lib/components/common/Icon.svelte';

	// One stat: an icon or colour dot, a value and a tooltip with the full label
	let {
		icon,
		iconClass,
		dot,
		value,
		label,
		size = 13,
		trailing
	}: {
		icon?: Component<{ size?: number | string; class?: string }>;
		iconClass?: string;
		dot?: string | null;
		value: string | number;
		label: string;
		size?: number;
		trailing?: Snippet;
	} = $props();
</script>

<Tooltip.Provider delayDuration={150} disableHoverableContent>
	<Tooltip.Root>
		<Tooltip.Trigger
			aria-label={label}
			class="text-muted-foreground hover:text-foreground focus-visible:ring-ring relative z-10 flex items-center gap-1 rounded tabular-nums transition-colors focus-visible:ring-1 focus-visible:outline-none"
		>
			{#if dot !== undefined}
				<span
					class="size-2.5 rounded-full"
					style="background-color: {dot ?? 'var(--muted-foreground)'}"
				></span>
			{:else if icon}
				<Icon {icon} {size} class={iconClass} />
			{/if}
			{#if value !== ''}{value}{/if}
			{@render trailing?.()}
		</Tooltip.Trigger>
		<Tooltip.Content class="pointer-events-none">{label}</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
