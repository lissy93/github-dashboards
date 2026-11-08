<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { page } from '$app/state';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu';
	import { navigationMenuTriggerStyle } from '$lib/components/ui/navigation-menu/navigation-menu-trigger.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
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

	const itemStyle = (active: boolean) =>
		cn(navigationMenuTriggerStyle(), 'gap-1.5', active && 'text-primary');
</script>

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
								aria-current={isActive(item) ? 'page' : undefined}
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
				{:else if item.disabled}
					<Tooltip.Provider delayDuration={150} disableHoverableContent>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props }: { props: Record<string, unknown> })}
									<span
										{...props}
										aria-disabled="true"
										class={cn(itemStyle(false), 'cursor-not-allowed text-muted-foreground/60')}
									>
										{#if item.icon}<Icon icon={item.icon} />{/if}
										{item.label}
									</span>
								{/snippet}
							</Tooltip.Trigger>
							{#if item.tooltip}<Tooltip.Content>{item.tooltip}</Tooltip.Content>{/if}
						</Tooltip.Root>
					</Tooltip.Provider>
				{:else}
					<NavigationMenu.Link
						href={item.href}
						active={isActive(item)}
						aria-current={isActive(item) ? 'page' : undefined}
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

<!-- Mobile nav lives in the collapsible drawer (burger in TopBar), so nothing renders here -->
