<script lang="ts">
	import { chartTip } from './chart-tip.svelte';
	import ChartTooltip from './ChartTooltip.svelte';
	import { DAYS_SHORT, DAYS_FULL } from '$lib/utils/datetime';
	import { formatNumber } from '$lib/utils/format';
	import type { ActivityRhythm } from '$lib/types';

	let { punch, peak }: { punch: number[][]; peak: ActivityRhythm['peak'] } = $props();

	const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

	const max = $derived(peak?.count ?? 0);
	// Dot fills a share of its square cell by area, so size reads as volume
	const dotPercent = (count: number) =>
		count > 0 && max > 0 ? Math.max(22, Math.sqrt(count / max) * 94) : 0;

	const tip = chartTip();

	// One listener for the grid, reading the hovered cell's data attributes
	function onMove(event: PointerEvent) {
		const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-hour]');
		if (!cell) return tip.hide();
		const weekday = Number(cell.dataset.weekday);
		const hour = Number(cell.dataset.hour);
		tip.show(event, {
			title: `${DAYS_FULL[weekday]} ${String(hour).padStart(2, '0')}:00 UTC`,
			rows: [{ label: 'Contributions', value: formatNumber(Number(cell.dataset.count)) }]
		});
	}
</script>

<div class="overflow-x-auto pb-1">
	<div class="min-w-[19rem] text-[0.6rem]">
		<div class="text-muted-foreground flex">
			<span class="w-9 shrink-0"></span>
			{#each HOURS as hour (hour)}
				<span class="flex-1 text-center">{hour % 3 === 0 ? hour : ''}</span>
			{/each}
		</div>
		<div
			role="img"
			aria-label="Activity by weekday and hour, peak {peak
				? `${DAYS_FULL[peak.weekday]} ${peak.hour}:00 UTC`
				: 'none'}"
			onpointermove={onMove}
			onpointerleave={tip.hide}
		>
			{#each punch as row, weekday (weekday)}
				<div class="flex items-center">
					<span class="text-muted-foreground w-9 shrink-0">{DAYS_SHORT[weekday]}</span>
					{#each row as count, hour (hour)}
						<span
							class="flex aspect-square flex-1 items-center justify-center p-[1px]"
							data-weekday={weekday}
							data-hour={hour}
							data-count={count}
						>
							{#if count > 0}
								<span
									class="rounded-full"
									style="width: {dotPercent(count)}%; height: {dotPercent(
										count
									)}%; background-color: var(--chart-1)"
								></span>
							{/if}
						</span>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
