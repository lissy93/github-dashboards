<script lang="ts">
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { compactNumber, formatNumber } from '$lib/format';
	import type { Slice } from '$lib/views/stats';

	let { data, height = 16 }: { data: Slice[]; height?: number } = $props();

	// Tile fills are arbitrary GitHub label hex, so the contrast ink must be fixed
	// near-black/near-white rather than a theme token that tracks the background
	const INK_LIGHT = '#fafafa';
	const INK_DARK = '#0a0a0a';
	const H = $derived(height * 16);

	let width = $state(0);

	type Box = { x: number; y: number; w: number; h: number };
	type Tile = Box & { slice: Slice };

	// Pick black or white text from a tile's perceived brightness
	function ink(hex: string): string {
		// Theme tokens (var(--chart-n)) aren't hex and are all light, so ink them dark
		if (!/^#?[0-9a-f]{6}$/i.test(hex)) return INK_DARK;
		const value = hex.replace('#', '');
		const red = parseInt(value.slice(0, 2), 16);
		const green = parseInt(value.slice(2, 4), 16);
		const blue = parseInt(value.slice(4, 6), 16);
		const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
		return luminance > 0.6 ? INK_DARK : INK_LIGHT;
	}

	// Worst aspect ratio in a row laid along a side of the given length
	function worst(areas: number[], length: number): number {
		const sum = areas.reduce((acc, area) => acc + area, 0);
		const max = Math.max(...areas);
		const min = Math.min(...areas);
		return Math.max((length * length * max) / (sum * sum), (sum * sum) / (length * length * min));
	}

	// Squarified treemap layout, keeping tiles close to square for readability
	function squarify(slices: Slice[], box: Box): Tile[] {
		const totalValue = slices.reduce((sum, slice) => sum + slice.value, 0);
		if (!totalValue) return [];
		const scale = (box.w * box.h) / totalValue;
		const items = slices.map((slice) => ({ slice, area: slice.value * scale }));
		const tiles: Tile[] = [];
		let { x, y, w, h } = box;
		let row: typeof items = [];
		const layoutRow = () => {
			const sum = row.reduce((acc, item) => acc + item.area, 0);
			const horizontal = w <= h;
			const length = horizontal ? w : h;
			const thickness = sum / length;
			let offset = 0;
			for (const item of row) {
				const extent = item.area / thickness;
				tiles.push({
					slice: item.slice,
					x: horizontal ? x + offset : x,
					y: horizontal ? y : y + offset,
					w: horizontal ? extent : thickness,
					h: horizontal ? thickness : extent
				});
				offset += extent;
			}
			if (horizontal) {
				y += thickness;
				h -= thickness;
			} else {
				x += thickness;
				w -= thickness;
			}
		};
		for (const item of items) {
			const side = Math.min(w, h);
			const current = row.map((entry) => entry.area);
			if (row.length && worst(current, side) <= worst([...current, item.area], side)) {
				layoutRow();
				row = [item];
			} else {
				row.push(item);
			}
		}
		if (row.length) layoutRow();
		return tiles;
	}

	const tiles = $derived(width > 0 ? squarify(data, { x: 0, y: 0, w: width, h: H }) : []);

	const tip = chartTip();
	const show = (event: PointerEvent, slice: Slice) =>
		tip.show(event, {
			title: slice.label,
			color: slice.color,
			rows: slice.rows ?? [{ label: 'Count', value: formatNumber(slice.value) }]
		});
</script>

<div
	class="relative w-full overflow-hidden rounded-md"
	style="height: {height}rem"
	bind:clientWidth={width}
>
	{#each tiles as tile (tile.slice.label)}
		<div
			class="absolute flex flex-col justify-between overflow-hidden p-1.5"
			style="left: {tile.x}px; top: {tile.y}px; width: {tile.w}px; height: {tile.h}px;
				background-color: {tile.slice.color}; color: {ink(tile.slice.color ?? '#888888')};
				outline: 1px solid var(--card)"
			role="img"
			aria-label="{tile.slice.label}, {tile.slice.value}"
			onpointermove={(event) => show(event, tile.slice)}
			onpointerleave={tip.hide}
		>
			{#if tile.w > 52 && tile.h > 26}
				<span class="truncate text-[0.7rem] leading-tight font-medium">{tile.slice.label}</span>
				<span class="text-[0.65rem] tabular-nums opacity-80">{compactNumber(tile.slice.value)}</span
				>
			{/if}
		</div>
	{/each}
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
