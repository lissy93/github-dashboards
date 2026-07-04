<script lang="ts">
	import { splinePath, nearestIndex, CHART_PAD } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import Gridlines from './Gridlines.svelte';
	import type { ContributionCurve } from '$lib/views/repo-stats';

	let { curve, height = 16 }: { curve: ContributionCurve; height?: number } = $props();

	const PAD = { ...CHART_PAD, left: 40 };
	const GRID = [0, 0.25, 0.5, 0.75, 1];
	const H = $derived(height * 16);

	let width = $state(0);
	let svg = $state<SVGSVGElement>();
	let hover = $state<number | null>(null);

	const geom = $derived.by(() => {
		const plotW = width - PAD.left - PAD.right;
		const plotH = H - PAD.top - PAD.bottom;
		const baseline = PAD.top + plotH;
		const xOf = (value: number) => PAD.left + value * plotW;
		const yOf = (value: number) => baseline - value * plotH;
		const pts = curve.points.map((point) => ({ x: xOf(point.x), y: yOf(point.y) }));
		const line = splinePath(pts, true);
		const area = `${line} L${pts.at(-1)!.x} ${baseline} L${pts[0].x} ${baseline} Z`;
		// The point on the curve where the core team clears its share threshold
		const coreMark = pts[curve.coreFactor];
		const yTicks = GRID.map((level) => ({ label: `${level * 100}%`, y: yOf(level) }));
		return { plotW, plotH, baseline, xOf, yOf, pts, line, area, coreMark, yTicks };
	});

	const tip = chartTip();
	// Read the cumulative share at the ranked position nearest the cursor
	function move(event: PointerEvent) {
		if (!svg || !geom.pts.length) return;
		const x = event.clientX - svg.getBoundingClientRect().left;
		const nearest = nearestIndex(
			geom.pts.map((point) => point.x),
			x
		);
		hover = nearest;
		const point = curve.points[nearest];
		tip.show(event, {
			title: `Top ${Math.round(point.x * curve.contributors)} of ${curve.contributors}`,
			rows: [
				{ label: 'Share of commits', value: `${Math.round(point.y * 100)}%` },
				{ label: 'Share of people', value: `${Math.round(point.x * 100)}%` }
			]
		});
	}
	function leave() {
		hover = null;
		tip.hide();
	}
</script>

<div class="w-full" style="height: {height}rem" bind:clientWidth={width}>
	{#if width > 0}
		<svg
			bind:this={svg}
			{width}
			height={H}
			role="img"
			aria-label="Contribution distribution, Gini {curve.gini.toFixed(2)}"
			onpointermove={move}
			onpointerleave={leave}
		>
			<Gridlines ticks={geom.yTicks} left={PAD.left} right={width - PAD.right} />

			<line
				class="stroke-muted-foreground"
				x1={geom.xOf(0)}
				y1={geom.yOf(0)}
				x2={geom.xOf(1)}
				y2={geom.yOf(1)}
				stroke-dasharray="3 3"
				opacity="0.5"
			/>

			<path d={geom.area} fill="var(--chart-1)" opacity="0.18" />
			<path d={geom.line} fill="none" stroke="var(--chart-1)" stroke-width="1.5" />

			<line
				x1={geom.coreMark.x}
				x2={geom.coreMark.x}
				y1={geom.coreMark.y}
				y2={geom.baseline}
				stroke="var(--primary)"
				stroke-dasharray="3 3"
				opacity="0.7"
			/>
			<circle
				cx={geom.coreMark.x}
				cy={geom.coreMark.y}
				r="3"
				fill="var(--primary)"
				stroke="var(--card)"
			/>

			{#if hover !== null}
				<circle
					cx={geom.pts[hover].x}
					cy={geom.pts[hover].y}
					r="3"
					fill="var(--chart-1)"
					stroke="var(--card)"
				/>
			{/if}

			<text
				class="fill-muted-foreground text-[0.65rem]"
				x={geom.xOf(0)}
				y={H - 6}
				text-anchor="start"
			>
				ranked by commits
			</text>
			<text
				class="fill-muted-foreground text-[0.65rem]"
				x={width - PAD.right}
				y={H - 6}
				text-anchor="end"
			>
				all contributors
			</text>
		</svg>
	{/if}
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
