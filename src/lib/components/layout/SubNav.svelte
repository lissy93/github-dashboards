<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/utils';

	// A pill-style secondary nav for sub-sections within a page group
	let { items }: { items: { label: string; href: string }[] } = $props();

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
</script>

<nav aria-label="Sub-sections" class="flex gap-1 border-b pb-2">
	{#each items as item (item.href)}
		<a
			href={item.href}
			aria-current={isActive(item.href) ? 'page' : undefined}
			class={cn(
				'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
				isActive(item.href)
					? 'bg-muted text-foreground'
					: 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
			)}
		>
			{item.label}
		</a>
	{/each}
</nav>
