<script lang="ts">
	import { stackColor, niceStep, splinePath, timeTicks, nearestIndex, CHART_PAD } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import ChartLegend from './ChartLegend.svelte';
	import Gridlines from './Gridlines.svelte';
	import { legendState } from './legend.svelte';
	import { compactNumber, formatNumber, formatDate } from '$lib/utils/format';
	import type { StarStack } from '$lib/views/stats';

	let {
		data,
		height = 15,
		smooth = true
	}: { data: StarStack; height?: number; smooth?: boolean } = $props();

	const PAD = CHART_PAD;
	const Y_TICKS = 5;
	const H = $derived(height * 16);

	let width = $state(0);
	let svg = $state<SVGSVGElement>();
	let hover = $state<number | null>(null);
	const legend = legendState();

	// Each band keyed and coloured up front, so hiding one never recolours the rest. The
	// Other band stays muted, the top repos cycle the shared palette
	const allBands = $derived(
		data.series.map((item, index) => ({
			...item,
			key: String(index),
			color: item.label === 'Other' ? 'var(--muted-foreground)' : stackColor(index)
		}))
	);
	const visible = $derived(allBands.filter((band) => !legend.hidden.has(band.key)));

	const geom = $derived.by(() => {
		const { days } = data;
		const shown = visible;
		// Total of the shown bands only, so hiding one rescales the axis
		const total = days.map((_, day) => shown.reduce((sum, band) => sum + band.values[day], 0));
		const times = days.map((day) => Date.parse(day));
		const first = times[0];
		const span = (times.at(-1) ?? 0) - first || 1;
		const axisTop = Math.max(1, ...total);
		const step = niceStep(axisTop, Y_TICKS);
		const plotH = H - PAD.top - PAD.bottom;
		const xs = times.map(
			(time) => PAD.left + ((time - first) / span) * (width - PAD.left - PAD.right)
		);
		const yOf = (value: number) => PAD.top + (1 - value / axisTop) * plotH;
		// Cumulative upper edge per band, largest series on the bottom
		const upper = shown.map(() => new Array(days.length).fill(0));
		for (let day = 0; day < days.length; day++) {
			let stacked = 0;
			for (let index = 0; index < shown.length; index++) {
				stacked += shown[index].values[day];
				upper[index][day] = stacked;
			}
		}
		const bands = shown.map((band, index) => {
			const lower = index > 0 ? upper[index - 1] : null;
			const edge = xs.map((x, day) => ({ x, y: yOf(upper[index][day]) }));
			const base = xs.map((x, day) => ({ x, y: yOf(lower ? lower[day] : 0) })).reverse();
			// Smooth the upper edge, then trace the (equally smoothed) lower edge back
			const d = `${splinePath(edge, smooth)} L${splinePath(base, smooth).slice(1)} Z`;
			return { key: band.key, color: band.color, d };
		});
		const outline = splinePath(
			xs.map((x, day) => ({ x, y: yOf(total[day]) })),
			smooth
		);
		// Gridlines at clean steps up to the data max, which sits flush with the top
		const yTicks = Array.from({ length: Math.floor(axisTop / step) + 1 }, (_, index) => ({
			label: compactNumber(Math.round(index * step)),
			y: yOf(index * step)
		}));
		return { xs, baseline: PAD.top + plotH, bands, outline, yTicks, total };
	});

	// A vertical line per calendar year, falling back to a few dates for short ranges
	const xTicks = $derived.by(() => {
		const days = data.days;
		if (!days.length) return [];
		const first = Date.parse(days[0]);
		const last = Date.parse(days.at(-1)!);
		const span = last - first || 1;
		return timeTicks(first, last).map((tick) => ({
			label: tick.label,
			x: PAD.left + ((tick.ms - first) / span) * (width - PAD.left - PAD.right),
			line: tick.year
		}));
	});

	// Each band's latest cumulative is its current star count, shown in the legend tooltip
	const legendItems = $derived(
		allBands.map((band) => ({
			key: band.key,
			label: band.label,
			color: band.color,
			total: band.values.at(-1)
		}))
	);

	const tip = chartTip();
	// Show the per-repo breakdown for the day nearest the cursor, shown bands only
	function move(event: PointerEvent) {
		if (!svg || !geom.xs.length) return;
		const x = event.clientX - svg.getBoundingClientRect().left;
		const nearest = nearestIndex(geom.xs, x);
		hover = nearest;
		tip.show(event, {
			title: formatDate(data.days[nearest]),
			rows: [
				...visible.map((band) => ({
					label: band.label,
					value: formatNumber(band.values[nearest]),
					color: band.color
				})),
				{ label: 'Total', value: formatNumber(geom.total[nearest]) }
			]
		});
	}
	function leave() {
		hover = null;
		tip.hide();
	}
</script>

<div class="flex flex-col gap-3">
	<ChartLegend items={legendItems} state={legend} totalLabel="Stars" />
	<div class="w-full" style="height: {height}rem" bind:clientWidth={width}>
		{#if width > 0 && data.days.length}
			<svg
				bind:this={svg}
				{width}
				height={H}
				role="img"
				aria-label="Star history by repository, total {formatNumber(data.total.at(-1) ?? 0)}"
				onpointermove={move}
				onpointerleave={leave}
			>
				<Gridlines ticks={geom.yTicks} left={PAD.left} right={width - PAD.right} />

				{#each xTicks as tick (tick.label)}
					{#if tick.line}
						<line
							class="stroke-chart-grid"
							x1={tick.x}
							x2={tick.x}
							y1={PAD.top}
							y2={geom.baseline}
						/>
					{/if}
					<text
						class="fill-muted-foreground text-[0.65rem] tabular-nums"
						x={tick.x}
						y={H - 6}
						text-anchor="middle"
					>
						{tick.label}
					</text>
				{/each}

				{#each geom.bands as band (band.key)}
					{@const fade = legend.hovered !== null && legend.hovered !== band.key}
					<path
						class="transition-opacity duration-150"
						d={band.d}
						fill={band.color}
						opacity={fade ? 0.2 : 0.85}
					/>
				{/each}
				<path
					d={geom.outline}
					fill="none"
					stroke="var(--foreground)"
					stroke-width="1"
					opacity="0.5"
				/>

				{#if hover !== null}
					<line
						x1={geom.xs[hover]}
						x2={geom.xs[hover]}
						y1={PAD.top}
						y2={geom.baseline}
						stroke="var(--foreground)"
						opacity="0.35"
					/>
				{/if}
			</svg>
		{/if}
	</div>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
