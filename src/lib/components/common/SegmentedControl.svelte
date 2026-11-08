<script lang="ts" generics="T extends string | number">
	import type { Component } from 'svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { cn } from '$lib/utils';

	// The shared pill toggle group, one active segment at a time
	type Option = {
		value: T;
		label: string;
		icon?: Component<{ size?: number | string; class?: string }>;
		hint?: string;
	};
	let {
		options,
		value = $bindable(),
		label,
		size = 'md',
		class: className
	}: {
		options: Option[];
		value: T;
		label?: string;
		size?: 'sm' | 'md';
		class?: string;
	} = $props();
</script>

{#snippet pill(option: Option)}
	<button
		type="button"
		aria-pressed={value === option.value}
		onclick={() => (value = option.value)}
		class={cn(
			'flex items-center gap-1.5 rounded transition-colors',
			size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1.5',
			value === option.value
				? 'bg-background text-foreground shadow-sm'
				: 'text-muted-foreground hover:text-foreground'
		)}
	>
		{#if option.icon}<Icon icon={option.icon} size={13} />{/if}{option.label}
	</button>
{/snippet}

<div
	class={cn('inline-flex rounded-md bg-muted p-0.5 text-xs', className)}
	role="group"
	aria-label={label}
>
	{#each options as option (option.value)}
		{#if option.hint}
			<Hint text={option.hint}>{@render pill(option)}</Hint>
		{:else}
			{@render pill(option)}
		{/if}
	{/each}
</div>
