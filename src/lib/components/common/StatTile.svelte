<script lang="ts">
	import type { Component } from 'svelte';
	import { TrendingUp, TrendingDown } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { cn } from '$lib/utils';

	type Props = {
		label: string;
		value: string | number;
		icon?: Component<{ size?: number | string; class?: string }>;
		delta?: number;
		hint?: string;
		class?: string;
	};
	let { label, value, icon, delta, hint, class: className }: Props = $props();
</script>

<Hint text={hint} class={cn('w-full flex-col items-start gap-1', hint && 'cursor-help', className)}>
	<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
		{#if icon}<Icon {icon} size={13} />{/if}
		<span class="truncate">{label}</span>
	</span>
	<span class="flex items-baseline gap-2">
		<span class="text-xl font-medium">{value}</span>
		{#if delta !== undefined && delta !== 0}
			<span
				class={cn('flex items-center gap-0.5 text-xs', delta > 0 ? 'text-success' : 'text-danger')}
			>
				<Icon icon={delta > 0 ? TrendingUp : TrendingDown} size={12} />
				{Math.abs(delta)}
			</span>
		{/if}
	</span>
</Hint>
