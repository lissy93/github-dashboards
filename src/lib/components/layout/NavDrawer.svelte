<script lang="ts">
	import { Menu, Lock, ArrowLeft } from '@lucide/svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import * as Sheet from '$lib/components/ui/sheet';
	import Icon from '$lib/components/common/Icon.svelte';
	import { cn } from '$lib/utils';
	import { navHrefs, type NavItem } from '$lib/components/layout/nav';
	import type { NavTree } from '$lib/state/nav-tree.svelte';

	let { tree }: { tree: NavTree } = $props();
	let open = $state(false);

	// Active leaf is the href that is the longest prefix of the current path
	const activeHref = $derived(
		navHrefs(tree.items)
			.filter((href) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`))
			.sort((first, second) => second.length - first.length)[0]
	);

	// A tap on any link navigates, so close the drawer once it settles
	afterNavigate(() => (open = false));
</script>

{#snippet row(item: NavItem, indent: boolean)}
	{#if item.disabled}
		<div class={cn('flex flex-col rounded-md px-3 py-2', indent && 'pl-9')}>
			<span class="text-muted-foreground/50 flex items-center gap-2 text-sm">
				{#if item.icon}<Icon icon={item.icon} />{/if}
				{item.label}
				<Icon icon={Lock} size={12} class="ml-auto" />
			</span>
			{#if item.tooltip}
				<span class="text-muted-foreground/50 mt-0.5 text-xs">{item.tooltip}</span>
			{/if}
		</div>
	{:else}
		<a
			href={item.href}
			aria-current={item.href === activeHref ? 'page' : undefined}
			class={cn(
				'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
				indent && 'pl-9',
				item.href === activeHref
					? 'bg-muted text-primary font-medium'
					: 'text-foreground hover:bg-muted/50'
			)}
		>
			{#if item.icon}<Icon icon={item.icon} />{/if}
			{item.label}
		</a>
	{/if}
{/snippet}

<Sheet.Root bind:open>
	<Sheet.Trigger
		aria-label="Open navigation"
		class="hover:bg-muted focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-md transition-colors focus-visible:ring-1 focus-visible:outline-none md:hidden"
	>
		<Icon icon={Menu} size={20} />
	</Sheet.Trigger>
	<Sheet.Content side="left" class="gap-0 p-0 data-[side=left]:w-72 data-[side=left]:sm:max-w-72">
		<div class="border-b p-4">
			{#if tree.backLink}
				<a
					href={tree.backLink.href}
					class="text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1.5 text-xs"
				>
					<Icon icon={ArrowLeft} size={14} />
					{tree.backLink.label}
				</a>
			{/if}
			<Sheet.Title class="text-sm font-semibold">
				<a href={tree.items[0]?.href} class="hover:text-primary transition-colors">{tree.label}</a>
			</Sheet.Title>
			<Sheet.Description class="sr-only">Jump to a page in {tree.label}</Sheet.Description>
		</div>
		<nav
			aria-label={tree.label}
			class="flex-1 overflow-y-auto p-2 pb-[env(safe-area-inset-bottom)]"
		>
			<ul class="space-y-0.5">
				{#each tree.items as item (item.label)}
					<li>{@render row(item, false)}</li>
					{#each item.children ?? [] as child (child.label)}
						<li>{@render row(child, true)}</li>
					{/each}
				{/each}
			</ul>
		</nav>
	</Sheet.Content>
</Sheet.Root>
