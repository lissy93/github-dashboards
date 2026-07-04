<script lang="ts">
	import type { Component } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import StatTile from '$lib/components/common/StatTile.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	export type Tile = {
		label: string;
		value: string | number;
		icon?: Component<{ size?: number | string; class?: string }>;
		delta?: number;
		hint?: string;
		class?: string;
	};

	// A card holding a responsive grid of stat tiles, shared by the headline strips
	let {
		tiles = [],
		loading = 0,
		class: className
	}: { tiles?: Tile[]; loading?: number; class?: string } = $props();
</script>

{#if loading || tiles.length}
	<Card.Root class={cn('grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 lg:grid-cols-7', className)}>
		{#if loading}
			{#each Array.from({ length: loading }, (_, index) => index) as index (index)}
				<div class="space-y-2">
					<Skeleton class="h-3 w-16" />
					<Skeleton class="h-6 w-12" />
				</div>
			{/each}
		{:else}
			{#each tiles as tile (tile.label)}
				<StatTile
					label={tile.label}
					value={tile.value}
					icon={tile.icon}
					delta={tile.delta}
					hint={tile.hint}
					class={tile.class}
				/>
			{/each}
		{/if}
	</Card.Root>
{/if}
