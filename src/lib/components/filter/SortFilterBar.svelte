<script lang="ts" generics="T">
	import { ArrowDownNarrowWide, ArrowUpNarrowWide } from '@lucide/svelte';
	import SearchInput from '$lib/components/common/SearchInput.svelte';
	import { Button } from '$lib/components/ui/button';
	import SelectFilter from '$lib/components/filter/SelectFilter.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import type { SortFilterConfig, View } from '$lib/utils/sort-filter';

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
</script>

<div class="flex flex-wrap items-center gap-2">
	{#if config.search}
		<SearchInput bind:value={view.search} placeholder={searchPlaceholder} class="min-w-40 flex-1" />
	{/if}

	{#each config.filters ?? [] as filter (filter.key)}
		<SelectFilter
			options={filter.options}
			allLabel="All {filter.label.toLowerCase()}"
			bind:value={view.filters[filter.key]}
		/>
	{/each}

	{#if showSort}
		<SelectFilter
			options={config.sorts.map(({ key, label, disabled }) => ({
				value: key,
				label: disabled ? `${label} (loading)` : label,
				disabled
			}))}
			bind:value={view.sortKey}
		/>
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
