<script lang="ts">
	import { CircleDot, GitPullRequest } from '@lucide/svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { chartTip } from '$lib/components/charts/chart-tip.svelte';
	import ChartTooltip from '$lib/components/charts/ChartTooltip.svelte';
	import { HEATMAP_LEVELS } from '$lib/components/charts/chart';
	import { compactNumber, formatNumber } from '$lib/utils/format';
	import type { HeatmapData, FlowScope } from '$lib/views/repo';

	let {
		data,
		scope,
		label = 'Activity by month'
	}: { data: HeatmapData; scope: FlowScope; label?: string } = $props();

	const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
	const MONTH_NAMES = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	// Colour follows status, shape follows kind, matching GitHub and the lifecycle palette
	const OPENED = 'var(--open)';
	const CLOSED = 'var(--merged)';
	const ROLE_COLOR = { opened: OPENED, closed: CLOSED, total: 'var(--foreground)' };
	const KIND_ICON = { issue: CircleDot, pr: GitPullRequest };

	// Map a count onto the five-step intensity ramp, empty months stay at level zero
	const color = (value: number) =>
		HEATMAP_LEVELS[
			value <= 0 || data.max <= 0 ? 0 : Math.min(4, Math.ceil((value / data.max) * 4))
		];

	const tip = chartTip();
	function onMove(event: PointerEvent) {
		const target = (event.target as HTMLElement).closest<HTMLElement>('[data-cell]');
		if (!target) return tip.hide();
		const row = data.rows[Number(target.dataset.row)];
		const cell = row.cells[Number(target.dataset.month)];
		const kinds =
			scope === 'both'
				? cell.lines.map((line) => ({
						label: line.kind === 'issue' ? 'Issues' : 'PRs',
						value: formatNumber(line.value)
					}))
				: [];
		tip.show(event, {
			title: `${MONTH_NAMES[Number(target.dataset.month)]} ${row.year}`,
			rows: [
				...kinds,
				{ label: 'Opened', value: formatNumber(cell.opened), color: OPENED },
				{ label: 'Closed', value: formatNumber(cell.closed), color: CLOSED }
			]
		});
	}
</script>

<div class="max-w-2xl overflow-x-auto pb-1">
	<div class="min-w-[20rem]">
		<div class="flex gap-[2px] text-[0.6rem] text-muted-foreground">
			<span class="w-9 shrink-0"></span>
			{#each MONTHS as month, index (index)}
				<span class="flex-1 text-center">{month}</span>
			{/each}
		</div>
		<div role="img" aria-label={label} onpointermove={onMove} onpointerleave={tip.hide}>
			{#each data.rows as row, rowIndex (row.year)}
				<div class="flex items-stretch gap-[2px] py-[2px]">
					<span
						class="flex w-9 shrink-0 items-center text-[0.6rem] text-muted-foreground tabular-nums"
					>
						{row.year}
					</span>
					{#each row.cells as cell, month (month)}
						{@const flow = cell.opened + cell.closed}
						<div
							class="aspect-square flex-1 rounded-sm sm:aspect-auto sm:min-h-[2.75rem] lg:min-h-[3.25rem]"
							data-cell
							data-row={rowIndex}
							data-month={month}
							style="background-color: {color(cell.total)}"
						>
							<!-- More detail unlocks at each wider breakpoint: bar, then counts, then icons -->
							<div
								class="m-px hidden h-[calc(100%-2px)] flex-col rounded-[2px] p-1 sm:flex md:bg-card/80"
							>
								{#if flow === 0}
									<span class="m-auto text-[0.7rem] text-muted-foreground/40" aria-hidden="true">
										&middot;
									</span>
								{:else}
									<div
										class="hidden flex-col gap-0.5 text-[0.65rem] leading-none md:flex lg:text-xs"
									>
										{#each cell.lines.filter((line) => line.value > 0) as line (line.kind + line.role)}
											<span
												class="flex items-center gap-1 tabular-nums"
												style="color: {ROLE_COLOR[line.role]}"
											>
												<Icon
													icon={KIND_ICON[line.kind]}
													size={11}
													class="hidden shrink-0 text-muted-foreground lg:inline"
												/>
												{compactNumber(line.value)}
											</span>
										{/each}
									</div>
									<div class="mt-auto flex h-1 overflow-hidden rounded-full">
										{#if cell.opened > 0}
											<span style="width: {(cell.opened / flow) * 100}%; background-color: {OPENED}"
											></span>
										{/if}
										{#if cell.closed > 0}
											<span style="width: {(cell.closed / flow) * 100}%; background-color: {CLOSED}"
											></span>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>

<ChartTooltip data={tip.data} x={tip.x} y={tip.y} />
