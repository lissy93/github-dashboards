<script lang="ts">
	import { splinePath, niceStep, yearMarks } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { compactNumber, formatNumber, formatDate } from '$lib/format';

	type Week = { week: string; additions: number; deletions: number };
	let { data, height = 16 }: { data: Week[]; height?: number } = $props();

	const PAD = { top: 12, right: 14, bottom: 22, left: 46 };
	const HALF_TICKS = 2;
	const H = $derived(height * 16);

	let width = $state(0);
	let svg = $state<SVGSVGElement>();
	let hover = $state<number | null>(null);

	const geom = $derived.by(() => {
		const times = data.map((week) => Date.parse(week.week));
		const first = times[0];
		const span = (times.at(-1) ?? 0) - first || 1;
		const plotW = width - PAD.left - PAD.right;
		const plotH = H - PAD.top - PAD.bottom;
		const half = plotH / 2;
		const zeroY = PAD.top + half;
		// A shared scale top and bottom so added and removed lines read at one magnitude
		const peak = Math.max(1, ...data.map((week) => Math.max(week.additions, week.deletions)));
		const step = niceStep(peak, HALF_TICKS);
		const top = Math.ceil(peak / step) * step;
		const xs = times.map((time) => PAD.left + ((time - first) / span) * plotW);
		const up = (value: number) => zeroY - (value / top) * half;
		const down = (value: number) => zeroY + (value / top) * half;
		const addPts = xs.map((x, index) => ({ x, y: up(data[index].additions) }));
		const delPts = xs.map((x, index) => ({ x, y: down(data[index].deletions) }));
		const addArea = `${splinePath(addPts, true)} L${xs.at(-1)} ${zeroY} L${xs[0]} ${zeroY} Z`;
		const delArea = `${splinePath(delPts, true)} L${xs.at(-1)} ${zeroY} L${xs[0]} ${zeroY} Z`;
		const ticks: { value: number; y: number }[] = [];
		for (let value = step; value <= top + step / 2; value += step) {
			ticks.push({ value, y: up(value) }, { value: -value, y: down(value) });
		}
		return { xs, zeroY, addArea, delArea, ticks, plotW };
	});

	// A vertical guide per calendar year, falling back to a few dates for short ranges
	const xTicks = $derived.by(() => {
		if (!data.length) return [];
		const first = Date.parse(data[0].week);
		const last = Date.parse(data.at(-1)!.week);
		const span = last - first || 1;
		const years = yearMarks(first, last).map((mark) => ({
			label: String(mark.year),
			x: geom.xs[0] + ((mark.ms - first) / span) * geom.plotW
		}));
		if (years.length >= 2) return years;
		return [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])].map((index) => ({
			label: formatDate(data[index].week),
			x: geom.xs[index]
		}));
	});

	const tip = chartTip();
	// Surface the additions, deletions and net for the week nearest the cursor
	function move(event: PointerEvent) {
		if (!svg || !geom.xs.length) return;
		const x = event.clientX - svg.getBoundingClientRect().left;
		const nearest = geom.xs.reduce(
			(best, cx, index) => (Math.abs(cx - x) < Math.abs(geom.xs[best] - x) ? index : best),
			0
		);
		hover = nearest;
		const week = data[nearest];
		tip.show(event, {
			title: `Week of ${formatDate(week.week)}`,
			rows: [
				{ label: 'Added', value: formatNumber(week.additions), color: 'var(--success)' },
				{ label: 'Removed', value: formatNumber(week.deletions), color: 'var(--danger)' },
				{ label: 'Net', value: formatNumber(week.additions - week.deletions) }
			]
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
			aria-label="Code churn over time, lines added above and removed below"
			onpointermove={move}
			onpointerleave={leave}
		>
			{#each geom.ticks as tick (tick.value)}
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
					{compactNumber(Math.abs(tick.value))}
				</text>
			{/each}

			{#each xTicks as tick (tick.label)}
				<text
					class="fill-muted-foreground text-[0.65rem] tabular-nums"
					x={tick.x}
					y={H - 6}
					text-anchor="middle"
				>
					{tick.label}
				</text>
			{/each}

			<path d={geom.addArea} fill="var(--success)" opacity="0.7" />
			<path d={geom.delArea} fill="var(--danger)" opacity="0.7" />
			<line
				x1={PAD.left}
				x2={width - PAD.right}
				y1={geom.zeroY}
				y2={geom.zeroY}
				stroke="var(--foreground)"
				opacity="0.4"
			/>

			{#if hover !== null}
				<line
					x1={geom.xs[hover]}
					x2={geom.xs[hover]}
					y1={PAD.top}
					y2={H - PAD.bottom}
					stroke="var(--foreground)"
					opacity="0.35"
				/>
			{/if}
		</svg>
	{/if}
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
