<script lang="ts">
	import type { Component } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import StatTile from '$lib/components/common/StatTile.svelte';
	import { cn } from '$lib/utils';

	export type Tile = {
		label: string;
		value: string | number;
		icon?: Component<{ size?: number | string; class?: string }>;
		delta?: number;
		hint?: string;
	};

	// A card holding a responsive grid of stat tiles, shared by the headline strips
	let { tiles, class: className }: { tiles: Tile[]; class?: string } = $props();
</script>

{#if tiles.length}
	<Card.Root class={cn('grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 lg:grid-cols-7', className)}>
		{#each tiles as tile (tile.label)}
			<StatTile
				label={tile.label}
				value={tile.value}
				icon={tile.icon}
				delta={tile.delta}
				hint={tile.hint}
			/>
		{/each}
	</Card.Root>
{/if}
