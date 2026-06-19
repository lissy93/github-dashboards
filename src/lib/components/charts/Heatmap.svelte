<script lang="ts">
	import { HEATMAP_LEVELS } from './chart';
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import Hint from '$lib/components/common/Hint.svelte';
	import { contributionLevels, type LevelDay } from '$lib/views/stats';
	import { MONTHS_SHORT, DAYS_FULL, toMondayFirst } from '$lib/datetime';
	import { compactNumber, formatNumber, formatDate } from '$lib/format';
	import type { ContributionDay } from '$lib/types';

	let { days, year, total }: { days: ContributionDay[]; year: number; total: number } = $props();

	const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

	// Walk the whole calendar year into Sunday-aligned week columns, so a partial
	// year still spans full width with blank cells where days have no data yet
	const weeks = $derived.by(() => {
		const byDate = new Map(contributionLevels(days).map((day) => [day.date, day]));
		const columns: (LevelDay | null)[][] = [];
		let week: (LevelDay | null)[] = new Array(7).fill(null);
		const end = Date.UTC(year, 11, 31);
		for (let time = Date.UTC(year, 0, 1); time <= end; time += 86_400_000) {
			const date = new Date(time);
			const weekday = date.getUTCDay();
			if (weekday === 0 && (week.some(Boolean) || columns.length)) {
				columns.push(week);
				week = new Array(7).fill(null);
			}
			week[weekday] = byDate.get(date.toISOString().slice(0, 10)) ?? null;
		}
		columns.push(week);
		return columns;
	});

	// Month label above the column where a new month first appears
	const monthLabels = $derived.by(() => {
		let previous = -1;
		return weeks.map((week) => {
			const first = week.find(Boolean);
			const month = first ? new Date(`${first.date}T00:00:00Z`).getUTCMonth() : previous;
			if (month !== previous && first && Number(first.date.slice(8, 10)) <= 7) {
				previous = month;
				return MONTHS_SHORT[month];
			}
			previous = month;
			return '';
		});
	});

	const tip = chartTip();

	// One listener for the whole grid, reading the hovered cell's data attributes
	function onMove(event: PointerEvent) {
		const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-date]');
		if (!cell) return tip.hide();
		const date = cell.dataset.date as string;
		const count = Number(cell.dataset.count);
		tip.show(event, {
			title: `${DAYS_FULL[toMondayFirst(weekdayOf(date))]}, ${formatDate(date)}`,
			rows: [{ label: 'Contributions', value: formatNumber(count) }]
		});
	}
</script>

<div class="flex flex-col gap-1.5">
	<div class="flex items-baseline justify-between text-xs">
		<span class="font-medium">{year}</span>
		<Hint text="{formatNumber(total)} contributions" class="text-muted-foreground">
			{compactNumber(total)}
		</Hint>
	</div>
	<div class="overflow-x-auto pb-1">
		<div class="flex min-w-[18rem] flex-col gap-1">
			<div class="text-muted-foreground flex gap-[2px] text-[0.6rem]">
				{#each monthLabels as label, index (index)}
					<span class="min-w-0 flex-1 overflow-visible whitespace-nowrap">{label}</span>
				{/each}
			</div>
			<div
				class="flex gap-[2px]"
				role="img"
				aria-label="{year} contributions, {formatNumber(total)} total"
				onpointermove={onMove}
				onpointerleave={tip.hide}
			>
				{#each weeks as week, weekIndex (weekIndex)}
					<div class="flex flex-1 flex-col gap-[2px]">
						{#each week as day, dayIndex (dayIndex)}
							{#if day}
								<span
									class="aspect-square w-full rounded-[2px]"
									style="background-color: {HEATMAP_LEVELS[day.level]}"
									data-date={day.date}
									data-count={day.count}
								></span>
							{:else}
								<span class="aspect-square w-full"></span>
							{/if}
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
