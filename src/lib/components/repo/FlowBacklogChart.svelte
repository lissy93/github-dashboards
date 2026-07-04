<script lang="ts">
	import { niceMax, niceStep, splinePath } from '$lib/components/charts/chart';
	import { chartTip } from '$lib/components/charts/chart-tip.svelte';
	import ChartTooltip from '$lib/components/charts/ChartTooltip.svelte';
	import ChartLegend from '$lib/components/charts/ChartLegend.svelte';
	import Gridlines from '$lib/components/charts/Gridlines.svelte';
	import { legendState } from '$lib/components/charts/legend.svelte';
	import { compactNumber, formatNumber } from '$lib/utils/format';
	import type { FlowChart, FlowSeriesDef } from '$lib/views/repo';

	let {
		chart,
		height = 22,
		label = 'Issues and PRs over time'
	}: { chart: FlowChart; height?: number; label?: string } = $props();

	const PAD = { top: 14, bottom: 24, left: 40 };
	const FLOW_TICKS = 2;
	const BACK_TICKS = 4;
	const H = $derived(height * 16);
	// Room on the right only when a backlog axis is drawn there
	const padRight = $derived(chart.lines.length ? 42 : 14);

	let width = $state(0);
	let svg = $state<SVGSVGElement>();
	let hover = $state<number | null>(null);
	const legend = legendState();

	const allSeries = $derived([...chart.up, ...chart.down, ...chart.lines]);
	const upShown = $derived(chart.up.filter((series) => !legend.hidden.has(series.key)));
	const downShown = $derived(chart.down.filter((series) => !legend.hidden.has(series.key)));
	const lineShown = $derived(chart.lines.filter((series) => !legend.hidden.has(series.key)));

	const sumOf = (defs: FlowSeriesDef[], values: Record<string, number>) =>
		defs.reduce((total, series) => total + (values[series.key] ?? 0), 0);

	const geom = $derived.by(() => {
		const { bars } = chart;
		const plotW = width - PAD.left - padRight;
		const plotH = H - PAD.top - PAD.bottom;
		const zeroY = PAD.top + plotH / 2;
		const plotBottom = PAD.top + plotH;

		// Flow axis is symmetric around zero, opened above and closed below
		const flowPeak = Math.max(
			1,
			...bars.map((bar) => Math.max(sumOf(upShown, bar.values), sumOf(downShown, bar.values)))
		);
		const flowMax = niceMax(flowPeak);
		const flowStep = Math.max(1, Math.round(niceStep(flowMax, FLOW_TICKS)));
		const flowScale = plotH / 2 / flowMax;

		// Backlog reads off the right axis from zero at the baseline
		const backPeak = Math.max(
			1,
			...bars.flatMap((bar) => lineShown.map((series) => bar.values[series.key] ?? 0))
		);
		const backMax = niceMax(backPeak);
		const backStep = Math.max(1, Math.round(niceStep(backMax, BACK_TICKS)));
		const backScale = plotH / backMax;

		const slot = plotW / (bars.length || 1);
		const barWidth = Math.min(slot * 0.84, 32);
		const xOf = (index: number) => PAD.left + slot * (index + 0.5);

		// Per-bar stacked segments rising from and dropping below the zero line
		const columns = bars.map((bar, index) => {
			let upAcc = 0;
			const ups = upShown
				.map((series) => {
					const value = bar.values[series.key] ?? 0;
					const segment = {
						key: series.key,
						color: series.color,
						y: zeroY - (upAcc + value) * flowScale,
						h: value * flowScale,
						value
					};
					upAcc += value;
					return segment;
				})
				.filter((segment) => segment.value > 0);
			let downAcc = 0;
			const downs = downShown
				.map((series) => {
					const value = bar.values[series.key] ?? 0;
					const segment = {
						key: series.key,
						color: series.color,
						y: zeroY + downAcc * flowScale,
						h: value * flowScale,
						value
					};
					downAcc += value;
					return segment;
				})
				.filter((segment) => segment.value > 0);
			return { cx: xOf(index), ups, downs };
		});

		const lines = lineShown.map((series) => {
			const points = bars.map((bar, index) => ({
				x: xOf(index),
				y: plotBottom - (bar.values[series.key] ?? 0) * backScale
			}));
			return { ...series, path: splinePath(points, bars.length > 2), points };
		});

		const flowTicks: { label: string; y: number }[] = [];
		for (let value = 0; value <= flowMax; value += flowStep) {
			const label = compactNumber(value);
			flowTicks.push({ label, y: zeroY - value * flowScale });
			if (value) flowTicks.push({ label, y: zeroY + value * flowScale });
		}
		const backTicks: { value: number; y: number }[] = [];
		for (let value = 0; value <= backMax; value += backStep) {
			backTicks.push({ value, y: plotBottom - value * backScale });
		}
		const xTicks = chart.ticks
			.map((text, index) => ({ text, x: xOf(index) }))
			.filter((tick) => tick.text);

		return { zeroY, plotBottom, columns, lines, flowTicks, backTicks, xTicks, barWidth, slot };
	});

	// Sum totals for the bars, but the running backlog has no meaningful sum
	const legendItems = $derived(
		allSeries.map((series) => ({
			key: series.key,
			label: series.label,
			color: series.color,
			hint: series.hint,
			total:
				series.axis === 'line'
					? undefined
					: chart.bars.reduce((total, bar) => total + (bar.values[series.key] ?? 0), 0)
		}))
	);

	const tip = chartTip();
	function move(event: PointerEvent) {
		if (!svg || !chart.bars.length) return;
		const x = event.clientX - svg.getBoundingClientRect().left;
		const index = Math.max(
			0,
			Math.min(chart.bars.length - 1, Math.round((x - PAD.left) / geom.slot - 0.5))
		);
		hover = index;
		const bar = chart.bars[index];
		tip.show(event, {
			title: bar.label,
			rows: allSeries
				.filter((series) => !legend.hidden.has(series.key) && (bar.values[series.key] ?? 0) !== 0)
				.map((series) => ({
					label: series.label,
					value: formatNumber(bar.values[series.key] ?? 0),
					color: series.color
				}))
		});
	}
	function leave() {
		hover = null;
		tip.hide();
	}
</script>

<ChartLegend items={legendItems} state={legend} totalLabel="Total" class="mb-2" />

<div class="w-full" style="height: {height}rem" bind:clientWidth={width}>
	{#if width > 0 && chart.bars.length}
		<svg
			bind:this={svg}
			{width}
			height={H}
			role="img"
			aria-label={label}
			onpointermove={move}
			onpointerleave={leave}
		>
			<Gridlines ticks={geom.flowTicks} left={PAD.left} right={width - padRight} size="0.6rem" />

			<line
				x1={PAD.left}
				x2={width - padRight}
				y1={geom.zeroY}
				y2={geom.zeroY}
				stroke="var(--border)"
			/>

			{#if chart.lines.length}
				{#each geom.backTicks as tick (tick.value)}
					<text
						class="fill-muted-foreground text-[0.6rem] tabular-nums"
						x={width - padRight + 6}
						y={tick.y}
						dy="0.32em"
						text-anchor="start">{compactNumber(tick.value)}</text
					>
				{/each}
			{/if}

			{#each geom.columns as column, index (index)}
				{@const dim = hover !== null && hover !== index}
				{#each column.ups as segment (segment.key)}
					<rect
						x={column.cx - geom.barWidth / 2}
						y={segment.y}
						width={geom.barWidth}
						height={Math.max(0.5, segment.h)}
						fill={segment.color}
						opacity={dim ? 0.45 : 0.9}
					/>
				{/each}
				{#each column.downs as segment (segment.key)}
					<rect
						x={column.cx - geom.barWidth / 2}
						y={segment.y}
						width={geom.barWidth}
						height={Math.max(0.5, segment.h)}
						fill={segment.color}
						opacity={dim ? 0.45 : 0.9}
					/>
				{/each}
			{/each}

			{#each geom.lines as line (line.key)}
				<path
					d={line.path}
					fill="none"
					stroke={line.color}
					stroke-width="2"
					stroke-dasharray={line.dash ? '4 3' : ''}
				/>
			{/each}

			{#if hover !== null}
				<line
					x1={geom.columns[hover].cx}
					x2={geom.columns[hover].cx}
					y1={PAD.top}
					y2={geom.plotBottom}
					stroke="var(--foreground)"
					opacity="0.25"
				/>
				{#each geom.lines as line (line.key)}
					<circle cx={line.points[hover].x} cy={line.points[hover].y} r="2.5" fill={line.color} />
				{/each}
			{/if}

			{#each geom.xTicks as tick (tick.x)}
				<text
					class="fill-muted-foreground text-[0.6rem] tabular-nums"
					x={tick.x}
					y={H - 6}
					text-anchor="middle">{tick.text}</text
				>
			{/each}
		</svg>
	{/if}
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
