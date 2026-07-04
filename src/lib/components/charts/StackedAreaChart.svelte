<script lang="ts">
	import { stackColor, niceStep, splinePath, timeTicks, nearestIndex, CHART_PAD } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import Gridlines from './Gridlines.svelte';
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

	// Top repos cycle the palette, the Other band stays muted
	const colorFor = (index: number, label: string) =>
		label === 'Other' ? 'var(--muted-foreground)' : stackColor(index);

	const geom = $derived.by(() => {
		const { days, series, total } = data;
		const times = days.map((day) => Date.parse(day));
		const first = times[0];
		const span = (times.at(-1) ?? 0) - first || 1;
		// Clamp the axis top to the data so the stack fills the height, gridlines below
		const top = Math.max(1, ...total);
		const step = niceStep(top, Y_TICKS);
		const plotH = H - PAD.top - PAD.bottom;
		const xs = times.map(
			(time) => PAD.left + ((time - first) / span) * (width - PAD.left - PAD.right)
		);
		const yOf = (value: number) => PAD.top + (1 - value / top) * plotH;
		// Cumulative upper edge per band, largest series on the bottom
		const upper = series.map(() => new Array(days.length).fill(0));
		for (let day = 0; day < days.length; day++) {
			let stacked = 0;
			for (let band = 0; band < series.length; band++) {
				stacked += series[band].values[day];
				upper[band][day] = stacked;
			}
		}
		const bands = series.map((item, band) => {
			const lower = band > 0 ? upper[band - 1] : null;
			const top = xs.map((x, day) => ({ x, y: yOf(upper[band][day]) }));
			const bottom = xs.map((x, day) => ({ x, y: yOf(lower ? lower[day] : 0) })).reverse();
			// Smooth the upper edge, then trace the (equally smoothed) lower edge back
			const d = `${splinePath(top, smooth)} L${splinePath(bottom, smooth).slice(1)} Z`;
			return { label: item.label, color: colorFor(band, item.label), d };
		});
		const outline = splinePath(
			xs.map((x, day) => ({ x, y: yOf(total[day]) })),
			smooth
		);
		// Gridlines at clean steps up to the data max, which sits flush with the top
		const yTicks = Array.from({ length: Math.floor(top / step) + 1 }, (_, index) => ({
			label: compactNumber(Math.round(index * step)),
			y: yOf(index * step)
		}));
		return { xs, plotH, baseline: PAD.top + plotH, bands, outline, yTicks };
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

	const tip = chartTip();
	// Show the per-repo breakdown for the day nearest the cursor
	function move(event: PointerEvent) {
		if (!svg || !geom.xs.length) return;
		const x = event.clientX - svg.getBoundingClientRect().left;
		const nearest = nearestIndex(geom.xs, x);
		hover = nearest;
		tip.show(event, {
			title: formatDate(data.days[nearest]),
			rows: [
				...data.series.map((item, band) => ({
					label: item.label,
					value: formatNumber(item.values[nearest]),
					color: colorFor(band, item.label)
				})),
				{ label: 'Total', value: formatNumber(data.total[nearest]) }
			]
		});
	}
	function leave() {
		hover = null;
		tip.hide();
	}
</script>

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
					<line class="stroke-chart-grid" x1={tick.x} x2={tick.x} y1={PAD.top} y2={geom.baseline} />
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

			{#each geom.bands as band (band.label)}
				<path d={band.d} fill={band.color} opacity="0.85" />
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

<ul class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
	{#each data.series as item, index (item.label)}
		<li class="flex items-center gap-1.5">
			<span
				class="size-2.5 shrink-0 rounded-sm"
				style="background-color: {colorFor(index, item.label)}"
			></span>
			<span class="text-muted-foreground truncate">{item.label}</span>
		</li>
	{/each}
</ul>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
