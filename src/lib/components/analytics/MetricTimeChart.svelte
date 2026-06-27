<script lang="ts">
	import { niceStep, splinePath } from '$lib/components/charts/chart';
	import { chartTip } from '$lib/components/charts/chart-tip.svelte';
	import ChartTooltip from '$lib/components/charts/ChartTooltip.svelte';
	import ChartLegend from '$lib/components/charts/ChartLegend.svelte';
	import { legendState } from '$lib/components/charts/legend.svelte';
	import { compactNumber, formatNumber, formatDate } from '$lib/format';
	import type { ChartData } from '$lib/views/analytics';

	let {
		data,
		area = true,
		height = 16,
		label = 'Metric over time',
		unit
	}: { data: ChartData; area?: boolean; height?: number; label?: string; unit?: string } = $props();

	const PAD = { top: 12, right: 14, bottom: 22, left: 44 };
	const Y_TICKS = 5;
	const MAX_X_TICKS = 6;
	const H = $derived(height * 16);

	let width = $state(0);
	let svg = $state<SVGSVGElement>();
	let hover = $state<number | null>(null);
	const legend = legendState();

	// Series still drawn, after any are toggled off from the legend
	const visible = $derived(data.series.filter((item) => !legend.hidden.has(item.key)));

	const geom = $derived.by(() => {
		const { dates } = data;
		const times = dates.map((day) => Date.parse(day));
		const first = times[0] ?? 0;
		const span = (times.at(-1) ?? 0) - first || 1;
		// Rescale to the shown series, so hiding the tall one zooms into the rest
		const peak = Math.max(0, ...visible.flatMap((item) => item.values)) || 1;
		const step = niceStep(peak, Y_TICKS);
		const axisTop = Math.max(step, Math.ceil(peak / step) * step);
		const plotH = H - PAD.top - PAD.bottom;
		const plotW = width - PAD.left - PAD.right;
		const single = dates.length === 1;
		const xs = times.map((time) =>
			single ? PAD.left + plotW / 2 : PAD.left + ((time - first) / span) * plotW
		);
		const yOf = (value: number) => PAD.top + (1 - value / axisTop) * plotH;
		const baseline = PAD.top + plotH;

		const lines = visible.map((item) => {
			const points = xs.map((x, index) => ({ x, y: yOf(item.values[index]) }));
			const line = splinePath(points, !single);
			const fill = `${line} L${xs.at(-1)} ${baseline} L${xs[0]} ${baseline} Z`;
			return { ...item, line, fill, points };
		});

		const yTicks = Array.from({ length: Math.floor(axisTop / step) + 1 }, (_, index) => ({
			value: index * step,
			y: yOf(index * step)
		}));
		// A handful of evenly spaced date labels, readable across any window length
		const tickStep = Math.max(1, Math.ceil(dates.length / MAX_X_TICKS));
		const xTicks = dates
			.map((date, index) => ({ label: formatDate(date), x: xs[index], index }))
			.filter((tick) => tick.index % tickStep === 0);
		return { xs, baseline, lines, yTicks, xTicks };
	});

	// Legend tooltip shows each line's latest value, a sum would mislead for running counts
	const legendItems = $derived(
		data.series.map((item) => ({
			key: item.key,
			label: item.label,
			color: item.color,
			hint: item.hint,
			total: item.values.at(-1)
		}))
	);

	const tip = chartTip();
	function move(event: PointerEvent) {
		if (!svg || !geom.xs.length) return;
		const x = event.clientX - svg.getBoundingClientRect().left;
		const nearest = geom.xs.reduce(
			(best, cx, index) => (Math.abs(cx - x) < Math.abs(geom.xs[best] - x) ? index : best),
			0
		);
		hover = nearest;
		tip.show(event, {
			title: formatDate(data.dates[nearest]),
			rows: visible.map((item) => ({
				label: item.label,
				value: unit
					? `${formatNumber(item.values[nearest])} ${unit}`
					: formatNumber(item.values[nearest]),
				color: item.color
			}))
		});
	}
	function leave() {
		hover = null;
		tip.hide();
	}
</script>

<div class="w-full" style="height: {height}rem" bind:clientWidth={width}>
	{#if width > 0 && data.dates.length}
		<svg
			bind:this={svg}
			{width}
			height={H}
			role="img"
			aria-label={label}
			onpointermove={move}
			onpointerleave={leave}
		>
			{#each geom.yTicks as tick (tick.value)}
				<line
					class="stroke-chart-grid"
					x1={PAD.left}
					x2={width - PAD.right}
					y1={tick.y}
					y2={tick.y}
				/>
				<text
					class="fill-muted-foreground text-[0.65rem] tabular-nums"
					x={PAD.left - 6}
					y={tick.y}
					dy="0.32em"
					text-anchor="end"
				>
					{compactNumber(Math.round(tick.value))}
				</text>
			{/each}

			{#each geom.xTicks as tick (tick.index)}
				<text
					class="fill-muted-foreground text-[0.65rem] tabular-nums"
					x={tick.x}
					y={H - 6}
					text-anchor="middle"
				>
					{tick.label}
				</text>
			{/each}

			{#each geom.lines as item (item.key)}
				{@const lift = legend.hovered === item.key}
				{@const fade = legend.hovered !== null && !lift}
				{#if area}<path d={item.fill} fill={item.color} opacity={fade ? 0.04 : 0.12} />{/if}
				<path
					class="transition-[stroke-width,opacity] duration-150"
					d={item.line}
					fill="none"
					stroke={item.color}
					stroke-width={lift ? 2.5 : 1.5}
					opacity={fade ? 0.4 : 1}
				/>
			{/each}

			{#if hover !== null}
				<line
					x1={geom.xs[hover]}
					x2={geom.xs[hover]}
					y1={PAD.top}
					y2={geom.baseline}
					stroke="var(--foreground)"
					opacity="0.35"
				/>
				{#each geom.lines as item (item.key)}
					<circle cx={geom.xs[hover]} cy={item.points[hover].y} r="2.5" fill={item.color} />
				{/each}
			{/if}
		</svg>
	{/if}
</div>

<ChartLegend items={legendItems} state={legend} totalLabel="Latest" class="mt-2" />

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
