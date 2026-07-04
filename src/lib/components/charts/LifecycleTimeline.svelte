<script lang="ts">
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { compactNumber, formatDate, formatNumber } from '$lib/utils/format';
	import type { LifecycleData, LifecycleRow } from '$lib/views/stats';

	let { data, limit }: { data: LifecycleData; limit?: number } = $props();

	const shown = $derived(limit ? data.rows.slice(0, limit) : data.rows);
	const span = $derived(Math.max(1, data.end - data.start));
	const maxStars = $derived(Math.max(1, ...data.rows.map((row) => row.stars)));
	const position = (value: number) =>
		Math.max(0, Math.min(100, ((value - data.start) / span) * 100));
	const markerSize = (stars: number) => 5 + Math.sqrt(stars / maxStars) * 8;

	// Keep the year grid readable across both short and long histories
	const ticks = $derived.by(() => {
		if (!data.rows.length) return [];
		const first = new Date(data.start).getUTCFullYear();
		const last = new Date(data.end).getUTCFullYear();
		const step = Math.max(1, Math.ceil((last - first) / 8));
		const years = [];
		for (let year = first; year <= last; year += step) years.push(year);
		if (years.at(-1) !== last) years.push(last);
		return years.map((year) => ({
			label: String(year),
			left: position(Date.UTC(year, 0, 1))
		}));
	});

	const tip = chartTip();
	const tipFor = (row: LifecycleRow) => ({
		title: row.name,
		color: row.color ?? 'var(--muted-foreground)',
		rows: [
			{ label: 'Created', value: formatDate(row.createdAt) },
			{ label: 'Last push', value: formatDate(row.pushedAt) },
			{ label: 'Stars', value: formatNumber(row.stars) },
			{ label: 'Language', value: row.language },
			...(row.archived ? [{ label: 'Status', value: 'Archived' }] : [])
		]
	});
</script>

<div class="overflow-x-auto pb-1">
	<div class="min-w-[42rem]">
		<div class="grid grid-cols-[9rem_1fr_3rem] gap-3 pb-2 text-[0.65rem]">
			<span class="text-muted-foreground">Most starred first</span>
			<div class="relative h-4">
				{#each ticks as tick (tick.label)}
					<span
						class="text-muted-foreground absolute -translate-x-1/2 tabular-nums"
						style="left: {tick.left}%"
					>
						{tick.label}
					</span>
				{/each}
			</div>
			<span class="text-muted-foreground text-right">Stars</span>
		</div>

		<ul class="flex flex-col gap-1.5">
			{#each shown as row (row.url)}
				{@const color = row.color ?? 'var(--muted-foreground)'}
				<li class="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-xs">
					<a class="truncate hover:underline" href={row.url}>{row.name}</a>
					<div
						class="bg-muted/35 relative h-5 rounded-sm"
						role="img"
						aria-label="{row.name}, created {formatDate(row.createdAt)}, last pushed {formatDate(
							row.pushedAt
						)}, {formatNumber(row.stars)} stars"
						onpointermove={(event) => tip.show(event, tipFor(row))}
						onpointerleave={tip.hide}
					>
						{#each ticks as tick (tick.label)}
							<span class="border-chart-grid absolute inset-y-0 border-l" style="left: {tick.left}%"
							></span>
						{/each}
						{#each row.segments as segment, index (index)}
							{@const left = position(segment.start)}
							{@const width = Math.max(0, position(segment.end) - left)}
							<span
								class="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
								class:rounded-none={!segment.active}
								class:opacity-50={!segment.active || row.archived}
								style="left: {left}%; width: max(3px, {width}%); background-color: {color}"
							></span>
						{/each}
						<span
							class="border-card absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
							class:opacity-60={row.archived}
							style="left: {position(row.end)}%; width: {markerSize(
								row.stars
							)}px; height: {markerSize(row.stars)}px; background-color: {color}"
						></span>
					</div>
					<span class="text-muted-foreground text-right tabular-nums">
						{compactNumber(row.stars)}
					</span>
				</li>
			{/each}
		</ul>
	</div>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
