<svelte:options namespace="svg" />

<script lang="ts">
	// Horizontal gridlines with right-aligned labels in the left gutter
	let {
		ticks,
		left,
		right,
		size = '0.65rem'
	}: {
		ticks: { y: number; label: string }[];
		left: number;
		right: number;
		size?: string;
	} = $props();
</script>

{#each ticks as tick (tick.y)}
	<line class="stroke-chart-grid" x1={left} x2={right} y1={tick.y} y2={tick.y} />
	<text
		class="fill-muted-foreground tabular-nums"
		style="font-size: {size}"
		x={left - 6}
		y={tick.y}
		dy="0.32em"
		text-anchor="end"
	>
		{tick.label}
	</text>
{/each}
