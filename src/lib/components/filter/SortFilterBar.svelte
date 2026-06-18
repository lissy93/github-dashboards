<script lang="ts" generics="T">
	import { Search, ArrowDownNarrowWide, ArrowUpNarrowWide } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import Icon from '$lib/components/common/Icon.svelte';
	import type { SortFilterConfig, View } from '$lib/components/filter/sort-filter';

	type Props = {
		config: SortFilterConfig<T>;
		view: View;
		searchPlaceholder?: string;
		showSort?: boolean;
		showDir?: boolean;
	};
	let {
		config,
		view = $bindable(),
		searchPlaceholder = 'Search',
		showSort = true,
		showDir = true
	}: Props = $props();

	const sortLabel = $derived(config.sorts.find((sort) => sort.key === view.sortKey)?.label ?? '');
	function filterLabel(key: string): string {
		const filter = config.filters?.find((option) => option.key === key);
		const current = filter?.options.find((option) => option.value === view.filters[key]);
		return current?.label ?? `All ${filter?.label.toLowerCase()}`;
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	{#if config.search}
		<div class="relative min-w-40 flex-1">
			<Icon
				icon={Search}
				size={15}
				class="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2"
			/>
			<Input bind:value={view.search} placeholder={searchPlaceholder} class="h-9 pl-8" />
		</div>
	{/if}

	{#each config.filters ?? [] as filter (filter.key)}
		<Select.Root type="single" bind:value={view.filters[filter.key]}>
			<Select.Trigger class="h-9">{filterLabel(filter.key)}</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All {filter.label.toLowerCase()}</Select.Item>
				{#each filter.options as option (option.value)}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	{/each}

	{#if showSort}
		<Select.Root type="single" bind:value={view.sortKey}>
			<Select.Trigger class="h-9">{sortLabel}</Select.Trigger>
			<Select.Content>
				{#each config.sorts as sort (sort.key)}
					<Select.Item value={sort.key} disabled={sort.disabled}>
						{sort.label}{sort.disabled ? ' (loading)' : ''}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	{/if}

	{#if showDir}
		<Button
			variant="outline"
			size="icon"
			class="size-9"
			aria-label="Toggle sort direction"
			onclick={() => (view.dir = view.dir === 'asc' ? 'desc' : 'asc')}
		>
			<Icon icon={view.dir === 'asc' ? ArrowUpNarrowWide : ArrowDownNarrowWide} />
		</Button>
	{/if}
</div>
