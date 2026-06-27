<script lang="ts">
	import { tick, type Component, type Snippet } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { Separator } from '$lib/components/ui/separator';
	import Icon from '$lib/components/common/Icon.svelte';
	import { readStored, writeStored } from '$lib/storage';

	// A collapsible section of grouped panels, open by default, with a slug id for deep links
	let {
		title,
		icon,
		description,
		open = $bindable(true),
		children
	}: {
		title: string;
		icon?: Component<{ size?: number | string; class?: string }>;
		description?: string;
		open?: boolean;
		children: Snippet;
	} = $props();

	const id = $derived(
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
	);

	// Restore the saved state after mount (ready gates the transition so this first apply
	// is instant, while later user toggles still animate) and persist every change
	let ready = $state(false);
	$effect(() => {
		if (readStored(`section:${id}`) === '0') open = false;
		tick().then(() => (ready = true));
	});
	$effect(() => {
		if (ready) writeStored(`section:${id}`, open ? '1' : '0');
	});
</script>

<section {id} class="scroll-mt-20 space-y-4">
	<div class="space-y-1.5">
		<button
			type="button"
			onclick={() => (open = !open)}
			aria-expanded={open}
			aria-controls="{id}-panel"
			class="flex w-full items-center gap-2 text-left"
		>
			{#if icon}<Icon {icon} size={18} class="text-muted-foreground" />{/if}
			<h2 class="text-base font-semibold">{title}</h2>
			<Icon
				icon={ChevronDown}
				size={18}
				class="text-muted-foreground ml-auto transition-transform {open ? '' : '-rotate-90'}"
			/>
		</button>
		{#if description}<p class="text-muted-foreground text-sm">{description}</p>{/if}
		<Separator class="mt-2" />
	</div>

	{#if open}
		<div id="{id}-panel" class="space-y-4" transition:slide={{ duration: ready ? 150 : 0 }}>
			{@render children()}
		</div>
	{/if}
</section>
