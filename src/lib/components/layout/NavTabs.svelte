<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/utils';

	let { tabs }: { tabs: { label: string; href: string }[] } = $props();

	// Active tab is the one whose href is the longest prefix of the current path
	const activeHref = $derived(
		tabs
			.map((tab) => tab.href)
			.filter((href) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`))
			.sort((a, b) => b.length - a.length)[0]
	);
</script>

<nav class="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)]">
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			class={cn(
				'border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
				tab.href === activeHref
					? 'border-primary text-foreground'
					: 'text-muted-foreground hover:text-foreground border-transparent'
			)}
		>
			{tab.label}
		</a>
	{/each}
</nav>
