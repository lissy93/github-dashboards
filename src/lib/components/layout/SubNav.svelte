<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import { page } from '$app/state';
	import Icon from '$lib/components/common/Icon.svelte';
	import { cn } from '$lib/utils';
	import { navHrefs, type NavItem } from '$lib/components/layout/nav';

	// Pill-style secondary nav for a section's sub-pages
	let { items, label = 'Sub-sections' }: { items: NavItem[]; label?: string } = $props();

	// Active pill is the href that is the longest matching prefix of the current path
	const activeHref = $derived(
		navHrefs(items)
			.filter((href) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`))
			.sort((first, second) => second.length - first.length)[0]
	);
</script>

<!-- Segmented control so it reads as a secondary selector, not a second tab bar -->
<nav aria-label={label} class="flex">
	<div class="bg-muted/50 flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg p-1">
		{#each items as item (item.label)}
			{#if item.disabled}
				<span
					aria-disabled="true"
					title={item.tooltip}
					class="text-muted-foreground/50 flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap"
				>
					{#if item.icon}<Icon icon={item.icon} size={14} />{/if}
					{item.label}
					<Icon icon={Lock} size={12} />
				</span>
			{:else}
				<a
					href={item.href}
					aria-current={item.href === activeHref ? 'page' : undefined}
					class={cn(
						'flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors',
						item.href === activeHref
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					)}
				>
					{#if item.icon}<Icon icon={item.icon} size={14} />{/if}
					{item.label}
				</a>
			{/if}
		{/each}
	</div>
</nav>
