<script lang="ts">
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { packCircles } from '$lib/utils/pack';
	import type { Bubble } from '$lib/types/charts';

	let { data, height = 18 }: { data: Bubble[]; height?: number } = $props();

	// Smallest bubble stays this fraction of the largest, so a heavy contributor never dwarfs the
	// rest. With a square-root value scale it keeps the size range readable and bounded
	const MIN_WEIGHT = 0.4;
	// Absolute ceiling on a bubble radius as a share of the chart height, so a one-owner cloud
	// does not blow up into a single giant circle
	const MAX_RADIUS_FRAC = 0.42;
	const PAD = 4;
	const H = $derived(height * 16);

	let width = $state(0);
	let svg = $state<SVGSVGElement>();
	let hover = $state<number | null>(null);
	const uid = $props.id();

	// Pack once from the values: radius grows with the square root of the value, floored so small
	// owners stay visible, then packed into a tight cluster. Independent of pixel width
	const packed = $derived.by(() => {
		const peak = Math.max(1, ...data.map((bubble) => bubble.value));
		const weights = data.map(
			(bubble) => MIN_WEIGHT + Math.sqrt(bubble.value / peak) * (1 - MIN_WEIGHT)
		);
		const circles = packCircles(weights);
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for (const circle of circles) {
			minX = Math.min(minX, circle.x - circle.r);
			maxX = Math.max(maxX, circle.x + circle.r);
			minY = Math.min(minY, circle.y - circle.r);
			maxY = Math.max(maxY, circle.y + circle.r);
		}
		return { circles, minX, maxX, minY, maxY, peakWeight: Math.max(...weights, 1) };
	});

	// Scale and centre the packed cluster into the available box, capping the largest radius
	const tiles = $derived.by(() => {
		const boxW = width - PAD * 2;
		const boxH = H - PAD * 2;
		const spanX = packed.maxX - packed.minX || 1;
		const spanY = packed.maxY - packed.minY || 1;
		let scale = Math.min(boxW / spanX, boxH / spanY);
		const cap = (H * MAX_RADIUS_FRAC) / packed.peakWeight;
		if (scale > cap) scale = cap;
		const midX = (packed.minX + packed.maxX) / 2;
		const midY = (packed.minY + packed.maxY) / 2;
		return packed.circles.map((circle, index) => ({
			bubble: data[index],
			cx: width / 2 + (circle.x - midX) * scale,
			cy: H / 2 + (circle.y - midY) * scale,
			r: circle.r * scale
		}));
	});

	const tip = chartTip();
	// Highlight and describe the bubble under the cursor, or clear when over empty space
	function move(event: PointerEvent) {
		if (!svg) return;
		const rect = svg.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const index = tiles.findIndex((tile) => Math.hypot(tile.cx - x, tile.cy - y) <= tile.r);
		hover = index < 0 ? null : index;
		if (index < 0) {
			tip.hide();
			return;
		}
		const bubble = tiles[index].bubble;
		tip.show(event, {
			title: bubble.label,
			color: bubble.ring,
			note: bubble.note,
			rows: bubble.rows
		});
	}
	function leave() {
		hover = null;
		tip.hide();
	}
</script>

<div class="w-full" style="height: {height}rem" bind:clientWidth={width}>
	{#if width > 0 && data.length}
		<svg
			bind:this={svg}
			{width}
			height={H}
			role="img"
			aria-label="Organisations and people contributed to, sized by pull requests"
			onpointermove={move}
			onpointerleave={leave}
		>
			{#each tiles as tile, index (tile.bubble.label)}
				{@const active = hover === index}
				<!-- One bubble scales gently around its own centre on hover for a touch of life -->
				<g class="bubble" class:active style="transform-origin: {tile.cx}px {tile.cy}px">
					<clipPath id="{uid}-{index}">
						<circle cx={tile.cx} cy={tile.cy} r={tile.r} />
					</clipPath>
					<circle cx={tile.cx} cy={tile.cy} r={tile.r} class="fill-muted" />
					{#if tile.r > 12}
						<text
							x={tile.cx}
							y={tile.cy}
							text-anchor="middle"
							dominant-baseline="central"
							class="fill-muted-foreground font-medium"
							style="font-size: {Math.round(tile.r * 0.7)}px"
						>
							{tile.bubble.initials}
						</text>
					{/if}
					<image
						href={tile.bubble.image}
						x={tile.cx - tile.r}
						y={tile.cy - tile.r}
						width={tile.r * 2}
						height={tile.r * 2}
						clip-path="url(#{uid}-{index})"
						preserveAspectRatio="xMidYMid slice"
					/>
					<circle
						cx={tile.cx}
						cy={tile.cy}
						r={tile.r}
						fill="none"
						stroke={active ? (tile.bubble.ring ?? 'var(--ring)') : 'var(--card)'}
						stroke-width={active ? 2 : 1}
					/>
				</g>
			{/each}
		</svg>
	{/if}
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />

<style>
	.bubble {
		/* view-box keeps the per-bubble transform-origin in the svg coordinate system */
		transform-box: view-box;
		transition: transform 140ms ease;
	}
	.bubble.active {
		transform: scale(1.05);
	}
</style>
