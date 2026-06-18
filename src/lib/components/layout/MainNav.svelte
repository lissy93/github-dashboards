<script lang="ts">
	import { Menu, ChevronDown } from '@lucide/svelte';
	import { page } from '$app/state';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu';
	import { navigationMenuTriggerStyle } from '$lib/components/ui/navigation-menu/navigation-menu-trigger.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import Icon from '$lib/components/common/Icon.svelte';
	import { cn } from '$lib/utils';
	import { navHrefs, type NavItem } from './nav';

	let { items, label = 'Sections' }: { items: NavItem[]; label?: string } = $props();

	// Active leaf is the href that is the longest prefix of the current path
	const activeHref = $derived(
		navHrefs(items)
			.filter((href) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`))
			.sort((first, second) => second.length - first.length)[0]
	);

	const isActive = (item: NavItem): boolean =>
		item.href === activeHref || (item.children?.some(isActive) ?? false);

	const activeLabel = $derived(items.find(isActive)?.label ?? items[0]?.label);

	const itemStyle = (active: boolean) =>
		cn(navigationMenuTriggerStyle(), 'gap-1.5', active && 'text-primary');
</script>

<!-- One burger row, child rows indented under their parent link -->
{#snippet menuLink(navItem: NavItem, indent: boolean)}
	<DropdownMenu.Item>
		{#snippet child({ props }: { props: Record<string, unknown> })}
			<a
				{...props}
				href={navItem.href}
				class={cn(props.class as string, indent && 'pl-8', isActive(navItem) && 'text-primary')}
			>
				{#if navItem.icon}<Icon icon={navItem.icon} />{/if}
				{navItem.label}
			</a>
		{/snippet}
	</DropdownMenu.Item>
{/snippet}

<!-- Desktop, hover-open dropdowns whose triggers link to their parent page -->
<NavigationMenu.Root
	viewport={false}
	aria-label={label}
	class="hidden w-full max-w-none justify-start border-b md:flex"
>
	<NavigationMenu.List class="justify-start gap-1">
		{#each items as item (item.label)}
			<NavigationMenu.Item>
				{#if item.children}
					<NavigationMenu.Trigger>
						{#snippet child({ props }: { props: Record<string, unknown> })}
							<a
								{...props}
								href={item.href}
								class={cn(props.class as string, 'gap-1.5', isActive(item) && 'text-primary')}
							>
								{#if item.icon}<Icon icon={item.icon} />{/if}
								{item.label}
								<Icon
									icon={ChevronDown}
									size={14}
									class="transition-transform duration-200 group-data-[state=open]/navigation-menu-trigger:rotate-180"
								/>
							</a>
						{/snippet}
					</NavigationMenu.Trigger>
					<NavigationMenu.Content class="z-50">
						<ul class="grid w-56 gap-0.5">
							{#each item.children as sub (sub.label)}
								<li>
									<NavigationMenu.Link
										href={sub.href}
										active={isActive(sub)}
										class={cn(isActive(sub) && 'text-primary')}
									>
										{#if sub.icon}<Icon icon={sub.icon} />{/if}
										{sub.label}
									</NavigationMenu.Link>
								</li>
							{/each}
						</ul>
					</NavigationMenu.Content>
				{:else}
					<NavigationMenu.Link
						href={item.href}
						active={isActive(item)}
						class={itemStyle(isActive(item))}
					>
						{#if item.icon}<Icon icon={item.icon} />{/if}
						{item.label}
					</NavigationMenu.Link>
				{/if}
			</NavigationMenu.Item>
		{/each}
	</NavigationMenu.List>
</NavigationMenu.Root>

<!-- Mobile, burger menu showing the current section -->
<div class="flex items-center border-b py-2 md:hidden">
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			aria-label="Open navigation"
			class="hover:bg-muted inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium"
		>
			<Icon icon={Menu} />
			{activeLabel}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content class="min-w-48">
			{#each items as item (item.label)}
				{@render menuLink(item, false)}
				{#each item.children ?? [] as sub (sub.label)}
					{@render menuLink(sub, true)}
				{/each}
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>
