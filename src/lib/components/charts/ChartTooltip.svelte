<script lang="ts">
	import type { TipData } from '$lib/views/stats';

	let { data, x, y }: { data: TipData | null; x: number; y: number } = $props();
</script>

<!-- Cursor-anchored tooltip, sits above the pointer and never intercepts it -->
{#if data}
	<div
		class="bg-popover pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border px-2.5 py-1.5 text-xs shadow-md"
		style="left: {x}px; top: {y - 10}px"
		role="tooltip"
	>
		<div class="flex items-center gap-1.5 font-medium">
			{#if data.color}
				<span class="size-2 shrink-0 rounded-sm" style="background-color: {data.color}"></span>
			{/if}
			{data.title}
		</div>
		{#if data.note}
			<p class="text-muted-foreground mt-0.5 max-w-44 text-[0.7rem] leading-snug">{data.note}</p>
		{/if}
		{#each data.rows as row (row.label)}
			<div class="flex justify-between gap-4 tabular-nums">
				<span class="text-muted-foreground flex items-center gap-1.5">
					{#if row.color}
						<span class="size-2 shrink-0 rounded-sm" style="background-color: {row.color}"></span>
					{/if}
					{row.label}
				</span>
				<span class="text-foreground">{row.value}</span>
			</div>
		{/each}
	</div>
{/if}
